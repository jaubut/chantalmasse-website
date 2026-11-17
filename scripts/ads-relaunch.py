#!/usr/bin/env python3
"""Read-only launch preflight; --enable --commit activates the two approved campaigns.

Run from the merged/deployed PR on the newsletter send day, after billing has
been checked in the Google Ads UI. Never infer payment validity from APPROVED.
Credentials come from the TLS environment/files; no third-party packages needed.
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import re
import shlex
import sys
import urllib.error
import urllib.parse
import urllib.request

CUSTOMER = "6902514931"
MANAGER = "6746327196"
CAMPAIGNS = {"21861912603": 5_000_000, "21866233181": 3_220_000}
BOOKING = "7906955419"
CONTACT = "7579925411"
LEGACY_FORM = "6918505399"
API = f"https://googleads.googleapis.com/v26/customers/{CUSTOMER}"
DAYS = {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}


def credentials():
    values = {}
    for path in [Path.home() / ".config/tls-agent/secrets.env",
                 Path.home() / "tls-dashboard-v2/.env"]:
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            match = re.match(r"^(?:export\s+)?(\w+)=(.*)$", line)
            if match:
                try:
                    parsed = shlex.split(match[2], comments=True)
                    if parsed:
                        values[match[1]] = parsed[0]
                except ValueError:
                    continue
    values.update(os.environ)
    return values


class Ads:
    def __init__(self):
        self.secrets = credentials()
        self.headers = {}
        refresh = self.secrets.get("GOOGLE_ADS_REFRESH_TOKEN")
        client_id = self.secrets.get("GOOGLE_ADS_CLIENT_ID") or self.secrets.get("GOOGLE_OAUTH_CLIENT_ID")
        client_secret = self.secrets.get("GOOGLE_ADS_CLIENT_SECRET") or self.secrets.get("GOOGLE_OAUTH_CLIENT_SECRET")
        if not refresh:
            db_url = self.require("TURSO_DATABASE_URL").replace("libsql://", "https://").rstrip("/")
            result = self.http(db_url + "/v2/pipeline", {
                "requests": [{"type": "execute", "stmt": {
                    "sql": "SELECT google_ads_customer_id, oauth_refresh_token FROM client_marketing WHERE client_slug = ?",
                    "args": [{"type": "text", "value": "chantal-masse"}],
                }}, {"type": "close"}],
            }, {"Authorization": "Bearer " + self.require("TURSO_AUTH_TOKEN")})
            response = result["results"][0]
            if response["type"] == "error":
                raise RuntimeError("Credential lookup failed")
            rows = response["response"]["result"]["rows"]
            require(len(rows) == 1, "Expected one Chantal marketing credential row")
            require(rows[0][0]["value"].replace("-", "") == CUSTOMER, "Credential customer mismatch")
            refresh = rows[0][1]["value"]
        require(bool(client_id and client_secret and refresh), "Missing Google OAuth credentials")
        self.secrets["active_refresh_token"] = refresh
        token = self.http("https://oauth2.googleapis.com/token", urllib.parse.urlencode({
            "client_id": client_id, "client_secret": client_secret,
            "refresh_token": refresh, "grant_type": "refresh_token",
        }).encode())["access_token"]
        self.secrets["active_access_token"] = token
        self.headers = {
            "Authorization": "Bearer " + token,
            "developer-token": self.require("GOOGLE_ADS_DEVELOPER_TOKEN"),
            "login-customer-id": MANAGER,
        }

    def require(self, name):
        value = self.secrets.get(name)
        require(bool(value), "Missing credential " + name)
        return value

    def http(self, url, body, headers=None):
        form = isinstance(body, bytes)
        data = body if form else json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, headers={
            "Content-Type": "application/x-www-form-urlencoded" if form else "application/json",
            **(headers or {}),
        })
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Error responses can contain request values; never log the raw body.
            raise RuntimeError(f"API request failed: HTTP {error.code} at {urllib.parse.urlsplit(url).hostname}") from None

    def query(self, query):
        rows, body = [], {"query": query}
        while True:
            result = self.http(API + "/googleAds:search", body, self.headers)
            rows.extend(result.get("results", []))
            if not result.get("nextPageToken"):
                return rows
            body["pageToken"] = result["nextPageToken"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def preflight(ads, expected_status="PAUSED"):
    account = ads.query("SELECT customer.id, customer.currency_code, customer.time_zone FROM customer")
    require(len(account) == 1, "Account missing")
    account = account[0]["customer"]
    require(account["id"] == CUSTOMER and account["currencyCode"] == "CAD"
            and account["timeZone"] == "America/Toronto", "Wrong customer/currency/time zone")
    campaigns = ads.query("""SELECT campaign.id, campaign.name, campaign.status,
        campaign.advertising_channel_type, campaign.end_date_time,
        campaign.network_settings.target_google_search, campaign.network_settings.target_search_network,
        campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network,
        campaign.bidding_strategy_type, campaign.target_spend.cpc_bid_ceiling_micros,
        campaign.geo_target_type_setting.positive_geo_target_type,
        campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared
        FROM campaign""")
    targets = {r["campaign"]["id"]: r for r in campaigns if r["campaign"]["id"] in CAMPAIGNS}
    require(set(targets) == set(CAMPAIGNS), "Both approved campaigns must exist")
    require(any(r["campaign"]["id"] == "21859287787" and r["campaign"]["status"] == "REMOVED"
                for r in campaigns), "SMART must remain removed")
    budget_names = set()
    for cid, amount in CAMPAIGNS.items():
        row = targets[cid]
        campaign, budget = row["campaign"], row["campaignBudget"]
        require(campaign["status"] == expected_status, f"Campaign {cid} must be {expected_status}")
        require(campaign["advertisingChannelType"] == "SEARCH" and not campaign.get("endDateTime"), "Channel/end date drift")
        require(int(budget["amountMicros"]) == amount and not budget.get("explicitlyShared"), "Budget drift")
        budget_names.add(budget["resourceName"])
        network = campaign["networkSettings"]
        require(network.get("targetGoogleSearch") and not any(network.get(k) for k in
                ["targetSearchNetwork", "targetContentNetwork", "targetPartnerSearchNetwork"]), "Network drift")
        require(campaign["biddingStrategyType"] == "TARGET_SPEND"
                and int(campaign["targetSpend"]["cpcBidCeilingMicros"]) == 1_500_000, "Bidding drift")
        require(campaign["geoTargetTypeSetting"]["positiveGeoTargetType"] == "PRESENCE", "Presence targeting drift")
    require(len(budget_names) == 2, "Budgets must be separate")
    criteria = ads.query("""SELECT campaign.id, campaign_criterion.type, campaign_criterion.status,
        campaign_criterion.negative, campaign_criterion.language.language_constant,
        campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units,
        campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
        campaign_criterion.proximity.geo_point.longitude_in_micro_degrees,
        campaign_criterion.ad_schedule.day_of_week, campaign_criterion.ad_schedule.start_hour,
        campaign_criterion.ad_schedule.start_minute, campaign_criterion.ad_schedule.end_hour,
        campaign_criterion.ad_schedule.end_minute FROM campaign_criterion""")
    for cid in CAMPAIGNS:
        positive = [r["campaignCriterion"] for r in criteria if r["campaign"]["id"] == cid
                    and not r["campaignCriterion"].get("negative")
                    and r["campaignCriterion"]["status"] != "REMOVED"]
        languages = [c for c in positive if c["type"] == "LANGUAGE"]
        require(len(languages) == 1 and languages[0]["language"]["languageConstant"] == "languageConstants/1002", "French-only drift")
        geo = [c for c in positive if c["type"] in ["LOCATION", "PROXIMITY"]]
        require(len(geo) == 1 and geo[0]["type"] == "PROXIMITY", "Geo coverage drift")
        proximity = geo[0]["proximity"]
        require(proximity["radius"] == 30 and proximity["radiusUnits"] == "KILOMETERS"
                and proximity["geoPoint"] == {"latitudeInMicroDegrees": 45345273,
                                               "longitudeInMicroDegrees": -72571197}, "Shefford radius drift")
        schedule = [c["adSchedule"] for c in positive if c["type"] == "AD_SCHEDULE"]
        require(len(schedule) == 7 and {s["dayOfWeek"] for s in schedule} == DAYS, "Daily schedule drift")
        require(all(s["startHour"] == 6 and s["endHour"] == 22 and s["startMinute"] == "ZERO"
                    and s["endMinute"] == "ZERO" for s in schedule), "Schedule hours drift")
    groups = ads.query("SELECT ad_group.id, ad_group.status FROM ad_group WHERE ad_group.id = 170304164363")
    require(len(groups) == 1 and groups[0]["adGroup"]["status"] == "PAUSED", "Coaching group must stay paused")
    conversions = ads.query("""SELECT conversion_action.id, conversion_action.name, conversion_action.status,
        conversion_action.primary_for_goal, conversion_action.category FROM conversion_action""")
    actions = {r["conversionAction"]["id"]: r["conversionAction"] for r in conversions}
    require(actions.get(BOOKING, {}).get("status") == "ENABLED"
            and actions[BOOKING].get("primaryForGoal")
            and actions[BOOKING]["category"] == "BOOK_APPOINTMENT", "Primary booking action missing")
    require(actions.get(CONTACT, {}).get("status") == "ENABLED"
            and actions[CONTACT]["name"] == "Contact"
            and actions[CONTACT].get("primaryForGoal") is False, "Contact must be secondary")
    require(actions.get(LEGACY_FORM, {}).get("status") == "REMOVED"
            and actions[LEGACY_FORM].get("primaryForGoal") is False, "Legacy form must remain removed/secondary")
    goals = ads.query("""SELECT campaign.id, campaign_conversion_goal.category,
        campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal""")
    for cid in CAMPAIGNS:
        active = [r["campaignConversionGoal"] for r in goals if r["campaign"]["id"] == cid
                  and r["campaignConversionGoal"].get("biddable")]
        require(len(active) == 1 and active[0]["category"] == "BOOK_APPOINTMENT"
                and active[0]["origin"] == "WEBSITE", "Only website booking goal may be biddable")
    configs = ads.query("""SELECT campaign.id, conversion_goal_campaign_config.custom_conversion_goal
        FROM conversion_goal_campaign_config""")
    require(all(not r["conversionGoalCampaignConfig"].get("customConversionGoal") for r in configs
                if r["campaign"]["id"] in CAMPAIGNS), "Custom goal can override secondary status")
    urls = ads.query("""SELECT campaign.id, ad_group_ad.status, ad_group_ad.ad.final_urls,
        ad_group_ad.ad.final_mobile_urls FROM ad_group_ad WHERE ad_group_ad.status != REMOVED""")
    for cid in CAMPAIGNS:
        expected = "https://chantalmasse.com/prendre-rendez-vous/" + ("?service=couple" if cid == "21861912603" else "")
        campaign_ads = [r["adGroupAd"]["ad"] for r in urls if r["campaign"]["id"] == cid]
        require(bool(campaign_ads), "No ads in target campaign")
        require(all(a.get("finalUrls") == [expected] and a.get("finalMobileUrls", []) in [[], [expected]]
                    for a in campaign_ads), "Ad destination drift")
    return [{"id": cid, "name": targets[cid]["campaign"]["name"],
             "status": expected_status, "dailyCAD": micros / 1_000_000} for cid, micros in CAMPAIGNS.items()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enable", action="store_true", help="Prepare activation; read-only unless --commit is also set")
    parser.add_argument("--commit", action="store_true", help="Enable BOTH campaigns on the authorized newsletter send day")
    parser.add_argument("--log", type=Path, default=Path.home() / ".local/state/tls/chantal-ads-activation.jsonl")
    args = parser.parse_args()
    if args.commit and not args.enable:
        parser.error("--commit requires --enable")
    ads = Ads()
    before = preflight(ads)
    operations = [{"update": {"resourceName": f"customers/{CUSTOMER}/campaigns/{cid}",
                               "status": "ENABLED"}, "updateMask": "status"} for cid in CAMPAIGNS]
    print(json.dumps({"mode": "COMMIT" if args.commit else "DRY RUN", "campaigns": before,
                      "proposedOperations": operations}, ensure_ascii=False, indent=2))
    if not args.commit:
        print("Read-only: no mutation sent. Deploy tracking and verify billing before send-day activation.")
        return
    args.log.parent.mkdir(parents=True, exist_ok=True)

    def log(phase, **details):
        with args.log.open("a") as stream:
            stream.write(json.dumps({"at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                     "customer": CUSTOMER, "manager": MANAGER,
                                     "phase": phase, **details}, ensure_ascii=False) + "\n")

    body = {"operations": operations, "partialFailure": False}
    log("requested", before=before, operations=operations)
    activation_sent = False
    try:
        ads.http(API + "/campaigns:mutate", {**body, "validateOnly": True}, ads.headers)
        log("validated")
        # Re-read after validation so an intervening settings change fails closed.
        preflight(ads)
        log("submitting")
        activation_sent = True
        response = ads.http(API + "/campaigns:mutate", body, ads.headers)
        log("applied", result=response)
        after = preflight(ads, expected_status="ENABLED")
        log("verified", after=after)
        print("Both Search campaigns ENABLED and verified. SMART/group unchanged. Log: " + str(args.log))
    except Exception as error:
        log("failed", activationSent=activation_sent, error=str(error))
        if activation_sent:
            raise RuntimeError("Activation was submitted but verification did not finish. "
                               "Campaigns may be LIVE; check account status and "
                               + str(args.log) + " before retrying.") from None
        raise


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, urllib.error.URLError) as error:
        print("Launch check failed: " + str(error), file=sys.stderr)
        sys.exit(1)
