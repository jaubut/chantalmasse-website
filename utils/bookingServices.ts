export type BookingServiceId = 'individual' | 'couple'

export interface BookingService {
  id: BookingServiceId
  name: string
  duration: string
  durationMinutes: number
  price: number
  description: string
  icon: string
  colorId: string
}

export const BOOKING_SERVICES: BookingService[] = [
  {
    id: 'individual',
    name: 'Thérapie Individuelle',
    duration: '60 minutes',
    durationMinutes: 60,
    price: 105,
    description: 'Un espace sécurisant pour explorer vos émotions et initier un changement profond.',
    icon: 'material-symbols:person',
    colorId: '2',
  },
  {
    id: 'couple',
    name: 'Coaching de Couple',
    duration: '90 minutes',
    durationMinutes: 90,
    price: 160,
    description: 'Un dialogue intentionnel pour transformer les conflits en opportunités de connexion.',
    icon: 'material-symbols:favorite',
    colorId: '7',
  },
]

export function getBookingService(id: BookingServiceId | string | null | undefined): BookingService | null {
  if (!id) return null
  return BOOKING_SERVICES.find(s => s.id === id) ?? null
}
