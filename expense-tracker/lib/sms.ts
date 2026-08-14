import { Capacitor } from '@capacitor/core'

export interface SmsMessage {
  sender: string
  body: string
  date: number
}

interface SmsReaderNative {
  checkPermissions: () => Promise<{ sms: string }>
  requestPermissions: () => Promise<{ sms: string }>
  readSms: (opts: { limit?: number; addressRegex?: string }) => Promise<{ messages: SmsMessage[]; count: number }>
}

declare global {
  interface Window {
    Capacitor?: { Plugins?: Record<string, SmsReaderNative> }
  }
}

export const isNative = () => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

const plugin = (): SmsReaderNative | undefined => window.Capacitor?.Plugins?.SmsReader

export const smsPermission = async (): Promise<string | null> => {
  try {
    const res = await plugin()?.checkPermissions()
    return res?.sms ?? null
  } catch {
    return null
  }
}

export const requestSmsPermission = async (): Promise<string | null> => {
  try {
    const res = await plugin()?.requestPermissions()
    return res?.sms ?? null
  } catch {
    return null
  }
}

export const readSms = async (limit = 100, addressRegex?: string): Promise<SmsMessage[]> => {
  const res = await plugin()?.readSms({ limit, addressRegex })
  return res?.messages ?? []
}
