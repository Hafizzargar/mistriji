export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const indianPhoneRegex = /^[6-9]\d{9}$/

export function isValidEmail(email: string) {
  return emailRegex.test(email.trim())
}

export function isValidIndianPhone(phone: string) {
  return indianPhoneRegex.test(phone.trim())
}

export function validateLogin(value: string) {
  const input = value.trim()
  if (emailRegex.test(input)) {
    return { type: 'email' as const, valid: true, cleanValue: input }
  }
  const numericInput = input.replace(/\D/g, '').slice(-10)
  if (indianPhoneRegex.test(numericInput)) {
    return { type: 'phone' as const, valid: true, cleanValue: numericInput }
  }
  return { type: 'invalid' as const, valid: false, cleanValue: input }
}
