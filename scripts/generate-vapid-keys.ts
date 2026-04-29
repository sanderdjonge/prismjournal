import webpush from 'web-push'

const vapidKeys = webpush.generateVAPIDKeys()

console.log('VAPID Public Key:')
console.log(vapidKeys.publicKey)
console.log('')
console.log('VAPID Private Key:')
console.log(vapidKeys.privateKey)
console.log('')
console.log('Add these to your .env file:')
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
