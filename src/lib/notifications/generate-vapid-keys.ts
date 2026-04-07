/**
 * Script to generate VAPID keys for Web Push notifications
 * Run: tsx src/lib/notifications/generate-vapid-keys.ts
 */
import webpush from 'web-push'

const vapidKeys = webpush.generateVAPIDKeys()

console.log('VAPID Keys Generated:')
console.log('====================')
console.log('Public Key:')
console.log(vapidKeys.publicKey)
console.log('\nPrivate Key:')
console.log(vapidKeys.privateKey)
console.log('\n\nAdd these to your .env.local file:')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`)
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`)
console.log(`VAPID_SUBJECT="mailto:admin@afyasolar.ubuntuafyalink.co.tz"`)

