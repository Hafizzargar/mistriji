import { supabase } from './supabase'

export interface LogAdminActionParams {
  actor: {
    id: string
    name?: string
    role?: string
    phone?: string | null
    email?: string | null
  } | null
  action: string
  targetType?: string
  targetId?: string
  details: string
  oldValue?: any
  newValue?: any
}

/**
 * Log an administrative action to audit_logs and generate real-time system notifications
 * for all Super Administrators.
 */
export async function logAdminAction(params: LogAdminActionParams) {
  const { actor, action, targetType, targetId, details, oldValue, newValue } = params
  if (!actor) return

  // Format actor identity
  const actorName = actor.name || 'Admin User'
  const actorContact = actor.phone && !actor.phone.startsWith('000') ? `+91 ${actor.phone}` : (actor.email || 'Admin')
  const actorDescription = `${actorName} (${actorContact})`

  try {
    // 1. Insert into audit_logs
    try {
      await supabase.from('audit_logs').insert({
        actor_id: actor.id,
        action: `${action}: ${details}`,
        target_id: targetId || null,
        target_type: targetType || null,
        old_value: oldValue ? oldValue : null,
        new_value: newValue ? newValue : null,
      })
    } catch (auditErr) {
      console.warn('Audit log table insert warning:', auditErr)
    }

    // 2. Query all Super Admins to send real-time notifications
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id, email, phone')
      .eq('role', 'super_admin')
      .eq('status', 'active')

    if (superAdmins && superAdmins.length > 0) {
      // Don't send notification to oneself if the actor is already the only super admin doing normal things,
      // but if an admin does an action, always notify the super admin.
      const notifRows = superAdmins
        .filter(sa => actor.role === 'admin' || sa.id !== actor.id)
        .map(sa => ({
          user_id: sa.id,
          title: `🛡️ Admin Action: ${action}`,
          message: `${actorDescription} ${details}`,
          type: 'system' as const,
          reference_id: targetId || null,
          is_read: false,
        }))

      if (notifRows.length > 0) {
        await supabase.from('notifications').insert(notifRows)
      }
    }
  } catch (err) {
    console.error('Failed to log admin action notification:', err)
  }
}
