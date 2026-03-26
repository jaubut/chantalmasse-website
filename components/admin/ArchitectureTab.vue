<template>
  <div>
    <h2 class="font-headline italic text-2xl text-primary mb-6">Architecture du système</h2>

    <!-- Flow diagram -->
    <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6 mb-6 overflow-x-auto">
      <div class="flex items-center gap-3 min-w-max mx-auto w-fit">
        <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
          <div class="text-2xl mb-2">📊</div>
          <div class="font-semibold text-primary text-sm mb-1">Meta Graph API</div>
          <div class="text-xs text-outline">Instagram + Facebook</div>
        </div>
        <div class="text-outline-variant text-2xl">→</div>
        <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
          <div class="text-2xl mb-2">⚙️</div>
          <div class="font-semibold text-primary text-sm mb-1">Nuxt.js App</div>
          <div class="text-xs text-outline">Cron hebdomadaire</div>
        </div>
        <div class="text-outline-variant text-2xl">→</div>
        <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
          <div class="text-2xl mb-2">🤖</div>
          <div class="font-semibold text-primary text-sm mb-1">Claude API</div>
          <div class="text-xs text-outline">Agent stratégique</div>
        </div>
        <div class="text-outline-variant text-2xl">→</div>
        <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
          <div class="text-2xl mb-2">📋</div>
          <div class="font-semibold text-primary text-sm mb-1">Brief</div>
          <div class="text-xs text-outline">Email / Dashboard</div>
        </div>
      </div>
    </div>

    <!-- Info cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6">
        <h3 class="font-semibold text-primary mb-3">Meta Graph API</h3>
        <ul class="space-y-2 text-sm text-on-surface-variant">
          <li>✓ Gratuit avec un compte Meta Business</li>
          <li>✓ Nécessite une App Review pour les insights</li>
          <li>✓ Données: portée, impressions, engagement, sauvegardes</li>
        </ul>
      </div>
      <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6">
        <h3 class="font-semibold text-primary mb-3">Configuration du cron</h3>
        <ul class="space-y-2 text-sm text-on-surface-variant">
          <li>✓ Vercel Cron Jobs (inclus avec Vercel Pro)</li>
          <li>✓ Déclenchement chaque lundi à 8h00</li>
          <li>✓ Livraison du brief par courriel automatique</li>
        </ul>
      </div>
    </div>

    <!-- Code block -->
    <div class="bg-[#1e1a17] rounded-2xl p-6 font-mono text-sm text-[#e8ddd0] overflow-x-auto">
      <div class="text-[#a09080] mb-3">// server/api/admin/generate-brief.post.ts</div>
      <div><span class="text-[#cce9dd]">export default</span> defineEventHandler(<span class="text-[#cce9dd]">async</span> (event) =&gt; &#123;</div>
      <div class="pl-4 text-[#a09080]">// 1. Vérifier l'authentification</div>
      <div class="pl-4"><span class="text-[#cce9dd]">const</span> session = getCookie(event, <span class="text-[#E07A5F]">'admin_session'</span>)</div>
      <div class="pl-4 mb-2"><span class="text-[#cce9dd]">if</span> (session !== <span class="text-[#E07A5F]">'authenticated'</span>) <span class="text-[#cce9dd]">throw</span> createError(&#123; statusCode: <span class="text-[#C9A84C]">401</span> &#125;)</div>
      <div class="pl-4 text-[#a09080]">// 2. Récupérer les statistiques Meta</div>
      <div class="pl-4 mb-2"><span class="text-[#cce9dd]">const</span> insights = getCachedInsights() || getMockInsights()</div>
      <div class="pl-4 text-[#a09080]">// 3. Appeler Claude API</div>
      <div class="pl-4"><span class="text-[#cce9dd]">const</span> message = <span class="text-[#cce9dd]">await</span> client.messages.create(&#123;</div>
      <div class="pl-8">model: <span class="text-[#E07A5F]">'claude-sonnet-4-6'</span>,</div>
      <div class="pl-8">max_tokens: <span class="text-[#C9A84C]">1500</span>,</div>
      <div class="pl-8">system: systemPrompt,</div>
      <div class="pl-4 mb-2">&#125;)</div>
      <div class="pl-4 text-[#a09080]">// 4. Retourner le brief</div>
      <div class="pl-4"><span class="text-[#cce9dd]">return</span> &#123; brief: message.content[<span class="text-[#C9A84C]">0</span>].text, generatedAt: <span class="text-[#cce9dd]">new</span> Date() &#125;</div>
      <div>&#125;)</div>
    </div>
  </div>
</template>
