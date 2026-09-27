import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { logAdminAction } from '@/lib/auditLogger'
import { JAMMU_AREAS, JAMMU_DISTRICT_OPTIONS, getAreasForDistrict } from '@/lib/jammuCoordinates'
import { AlertCircle, CheckCircle, UserPlus, ArrowLeft, Sparkles, Check, X, Loader2, RefreshCw } from 'lucide-react'

// ── Validation ────────────────────────────────────────────────
const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian number')
const schema = z.object({
  name:              z.string().trim().min(2, 'Name is required').max(60),
  phone:             phoneSchema,
  gender:            z.enum(['male', 'female', 'other']),
  vehicle_number:    z.string().trim().min(2, 'Vehicle number is required').optional().or(z.literal('')),
  skills:            z.array(z.string()).min(1, 'Select at least one skill'),
  experience_years:  z.coerce.number().int().min(0).max(50),
  district:          z.string().trim().min(1, 'District is required'),
  area:              z.string().trim().min(2, 'Area is required'),
  pincode:           z.string().trim().min(3, 'Pincode is required'),
  address:           z.string().trim().min(5, 'Address is required'),
  phone_type:        z.enum(['smartphone', 'keypad', 'none']),
  enrollment_method: z.enum(['field', 'self_call', 'employer', 'sms']),
  notes:             z.string().max(300).optional(),
  photo_url:         z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Skill { id: string; name: string; icon: string; category: string }

interface PhoneCheckState {
  status: 'idle' | 'checking' | 'available' | 'taken'
  message?: string
  existingUser?: any
}

// Sample Jammu names for test generator
const TEST_JAMMU_NAMES = [
  'Ramesh Sharma', 'Mohammad Tariq', 'Vikram Singh Jamwal', 'Amit Khajuria', 
  'Suresh Raina', 'Pawan Dogra', 'Abdul Rasheed', 'Rohit Sharma', 
  'Sunil Chib', 'Kuldeep Manhas', 'Parveen Gupta', 'Zahid Hussain'
]

export function WorkerEnrollPage() {
  const { user: currentUser } = useAuth()
  const navigate        = useNavigate()
  const toast           = useToast()
  const [skills, setSkills]       = useState<Skill[]>([])
  const [loading, setLoading]     = useState(false)
  const [testRunning, setTestRunning] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [phoneCheck, setPhoneCheck] = useState<PhoneCheckState>({ status: 'idle' })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const {
    register, handleSubmit, control,
    formState: { errors }, watch, reset, setValue, trigger
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone_type: 'smartphone',
      enrollment_method: 'field',
      experience_years: 3,
      gender: 'male',
      vehicle_number: '',
      skills: [],
      district: 'Jammu',
      area: 'Gandhi Nagar',
      pincode: '180004',
      address: '',
      photo_url: '',
    },
  })

  const watchedPhone = watch('phone')
  const selectedSkills = watch('skills')
  const selectedDistrict = watch('district')
  const selectedArea = watch('area')
  const districtOptions = JAMMU_DISTRICT_OPTIONS
  const areaOptions = useMemo(() => getAreasForDistrict(selectedDistrict || 'Jammu'), [selectedDistrict])

  // ── Debounced Phone Number Existence Check ───────────────────
  useEffect(() => {
    const rawPhone = (watchedPhone || '').trim()

    // Reset if phone is empty or incomplete
    if (rawPhone.length < 10) {
      setPhoneCheck({ status: 'idle' })
      return
    }

    if (!/^[6-9]\d{9}$/.test(rawPhone)) {
      setPhoneCheck({ status: 'idle' })
      return
    }

    setPhoneCheck({ status: 'checking', message: 'Checking phone availability…' })

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, role, status, phone, profiles(name, area, city)')
          .eq('phone', rawPhone)
          .maybeSingle()

        if (error) throw error

        if (data) {
          const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
          const userName = profile?.name ? `"${profile.name}"` : 'an existing user'
          setPhoneCheck({
            status: 'taken',
            message: `Already registered to ${userName} (${data.role.toUpperCase()})`,
            existingUser: data
          })
        } else {
          setPhoneCheck({
            status: 'available',
            message: '✓ Phone number is available for enrollment'
          })
        }
      } catch (err: any) {
        console.error('Phone check error:', err)
        setPhoneCheck({ status: 'idle' })
      }
    }, 450) // 450ms debounce

    return () => clearTimeout(timer)
  }, [watchedPhone])

  useEffect(() => {
    if (!selectedDistrict && districtOptions.length > 0) {
      setValue('district', districtOptions[0])
    }
  }, [districtOptions, selectedDistrict, setValue])

  useEffect(() => {
    const area = selectedArea && JAMMU_AREAS[selectedArea] ? selectedArea : areaOptions[0]
    if (!selectedArea || !JAMMU_AREAS[selectedArea]) {
      setValue('area', area)
      setValue('pincode', JAMMU_AREAS[area]?.pincode ?? '')
    } else if (JAMMU_AREAS[selectedArea]?.pincode) {
      setValue('pincode', JAMMU_AREAS[selectedArea].pincode)
    }
  }, [selectedArea, areaOptions, setValue])

  useEffect(() => {
    supabase.from('skills').select('id,name,icon,category').eq('is_active', true).order('sort_order')
      .then(({ data }) => setSkills(data ?? []))
  }, [])

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // ── Test Data Generator ─────────────────────────────────────
  const handleQuickFillTest = useCallback(() => {
    const randomName = TEST_JAMMU_NAMES[Math.floor(Math.random() * TEST_JAMMU_NAMES.length)]
    // Generate valid 10-digit Indian test mobile starting with 9876 + 6 random digits
    const randomPhone = '98' + Math.floor(10000000 + Math.random() * 90000000)
    
    // Pick 1-2 random skills
    let testSkills: string[] = []
    if (skills.length > 0) {
      const shuffled = [...skills].sort(() => 0.5 - Math.random())
      testSkills = shuffled.slice(0, Math.min(2, shuffled.length)).map(s => s.id)
    }

    const testDistrict = 'Jammu'
    const jammuAreas = getAreasForDistrict(testDistrict)
    const randomArea = jammuAreas[Math.floor(Math.random() * jammuAreas.length)] || 'Gandhi Nagar'
    const pincode = JAMMU_AREAS[randomArea]?.pincode || '180004'
    const randomExp = Math.floor(2 + Math.random() * 10)
    const randomVehicle = `JK02${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(1000 + Math.random() * 9000)}`

    setValue('name', randomName, { shouldValidate: true })
    setValue('phone', randomPhone, { shouldValidate: true })
    setValue('gender', 'male', { shouldValidate: true })
    setValue('district', testDistrict, { shouldValidate: true })
    setValue('area', randomArea, { shouldValidate: true })
    setValue('pincode', pincode, { shouldValidate: true })
    setValue('address', `H.No. ${Math.floor(10 + Math.random() * 90)}, Lane ${Math.floor(1 + Math.random() * 8)}, Near Chowk, ${randomArea}`, { shouldValidate: true })
    setValue('experience_years', randomExp, { shouldValidate: true })
    setValue('vehicle_number', randomVehicle, { shouldValidate: true })
    setValue('phone_type', 'smartphone')
    setValue('enrollment_method', 'field')
    setValue('notes', `[Automated Test Profile generated on ${new Date().toLocaleTimeString()}]`)
    
    if (testSkills.length > 0) {
      setValue('skills', testSkills, { shouldValidate: true })
    }

    toast.success(`Filled sample data for ${randomName} (${randomPhone})!`)
  }, [skills, setValue, toast])

  // ── Automated Full Enrollment Test ──────────────────────────
  async function handleRunEnrollmentTest() {
    setTestRunning(true)
    handleQuickFillTest()

    // Wait a brief moment for state and debounced check
    setTimeout(async () => {
      try {
        await handleSubmit(onSubmit)()
      } catch (e) {
        console.error('Test run failed', e)
      } finally {
        setTestRunning(false)
      }
    }, 600)
  }

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser. Please use Upload instead.')
      return
    }

    setIsCameraLoading(true)
    setCameraError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setCameraOpen(true)
    } catch (err) {
      console.error('Camera open error:', err)
      setCameraError('Camera permission was denied. Please use Upload or allow the browser camera access.')
      setCameraOpen(false)
    } finally {
      setIsCameraLoading(false)
    }
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop())
      cameraStreamRef.current = null
    }
    setCameraOpen(false)
  }

  function captureCameraPhoto() {
    if (!videoRef.current) {
      setCameraError('Live camera is not ready yet. Try opening it again.')
      return
    }

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Unable to capture the camera frame.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setPhotoPreview(dataUrl)
    setCameraError('')
    stopCamera()
  }

  async function onSubmit(values: FormValues) {
    if (phoneCheck.status === 'taken') {
      toast.error('Cannot enroll: A user with this phone number is already registered.')
      return
    }

    setLoading(true)
    try {
      // 1. Create user row
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .insert({ phone: values.phone, role: 'worker', status: 'active' })
        .select('id')
        .single()
      if (userErr) throw userErr
      const userId = userData.id

      // 2. Create profile
      const profilePayload: Record<string, any> = {
        user_id: userId,
        name: values.name,
        area: values.area,
        city: values.district || 'Jammu',
        gender: values.gender,
        vehicle_number: values.vehicle_number || null,
        photo_url: photoPreview || values.photo_url || null,
      }

      try {
        const { error: locErr } = await supabase.from('profiles').insert({
          ...profilePayload,
          district: values.district,
          pincode: values.pincode,
          address: values.address,
        })
        if (locErr) throw locErr
      } catch {
        await supabase.from('profiles').insert(profilePayload)
      }

      // 3. Create worker_profile
      await supabase.from('worker_profiles').insert({
        user_id:             userId,
        experience_years:    values.experience_years,
        is_available:        true,
        verification_status: 'pending',
        phone_type:          values.phone_type,
        enrollment_method:   values.enrollment_method,
        claimed:             false,
      })

      // 4. Create worker_skills
      if (values.skills.length > 0) {
        await supabase.from('worker_skills').insert(
          values.skills.map(sid => ({ worker_id: userId, skill_id: sid, experience_years: values.experience_years }))
        )
      }

      toast.success('Worker enrolled successfully!')
      
      logAdminAction({
        actor: currentUser,
        action: 'Worker Enrolled',
        targetType: 'worker',
        targetId: userId,
        details: `enrolled new worker "${values.name}" (+91 ${values.phone}) in ${values.area}, ${values.district}`,
      })

      setSuccess(true)
      reset()
      setPhotoPreview(null)
      setTimeout(() => navigate('/workers'), 2000)
    } catch (err: any) {
      console.error('Enroll worker error:', err)
      const msg = err.code === '23505' || err.message?.includes('23505') || err.message?.includes('users_phone_key')
        ? 'A worker with this phone number already exists.'
        : err.message ?? 'Something went wrong. Try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', maxWidth: 420 }}>
          <CheckCircle size={48} style={{ color: 'var(--success-500)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-900)' }}>Worker Enrolled!</h2>
          <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Profile created. Redirecting to workers list…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Enroll Worker</h1>
          <p className="page-subtitle">Add a verified technician to the MistriJi platform</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Quick Test Data Fill Button */}
          <button
            type="button"
            onClick={handleQuickFillTest}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontWeight: 700,
              background: '#f0fdf4',
              borderColor: '#86efac',
              color: '#15803d'
            }}
            title="Populate realistic Jammu worker test data"
          >
            <Sparkles size={14} style={{ color: '#16a34a' }} />
            <span>🧪 Fill Test Data</span>
          </button>

          {/* Quick 1-Click Test Enrollment Runner */}
          <button
            type="button"
            onClick={handleRunEnrollmentTest}
            disabled={loading || testRunning}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontWeight: 700,
              background: '#eff6ff',
              borderColor: '#bfdbfe',
              color: '#1d4ed8'
            }}
            title="Auto-fill and immediately enroll test worker"
          >
            <RefreshCw size={14} className={testRunning ? 'animate-spin' : ''} style={{ color: '#2563eb' }} />
            <span>{testRunning ? 'Testing…' : '🚀 Test Enroll Worker'}</span>
          </button>

          <Link
            to="/workers"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            <span>← Back to Workers</span>
          </Link>
        </div>
      </div>

      <div style={{ width: '100%' }}>
        {/* Main Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Personal Info */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1.25rem', color: 'var(--gray-800)' }}>
              👤 Personal Information
            </h2>
            <div className="form-row-2col">
              {/* Name */}
              <div className="input-wrapper">
                <label className="input-label">Full Name <span className="required">*</span></label>
                <input {...register('name')} className={`input ${errors.name ? 'error' : ''}`} placeholder="Abdul, Ramesh…" />
                {errors.name && <span className="input-error"><AlertCircle size={12}/> {errors.name.message}</span>}
              </div>

              {/* Phone with Debounced Check Feedback */}
              <div className="input-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>
                    Mobile Number <span className="required">*</span>
                  </label>
                  {watchedPhone && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                      {watchedPhone.length}/10 digits
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', marginTop: '0.375rem' }}>
                  <span style={{
                    padding: '0.625rem 0.625rem',
                    background: 'var(--gray-100)',
                    border: '1.5px solid var(--gray-300)',
                    borderRight: 'none',
                    borderRadius: '0.5rem 0 0 0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)',
                    whiteSpace: 'nowrap'
                  }}>
                    +91
                  </span>
                  <input
                    {...register('phone')}
                    className={`input ${errors.phone || phoneCheck.status === 'taken' ? 'error' : ''}`}
                    placeholder="98xxxxxxxx"
                    maxLength={10}
                    inputMode="numeric"
                    style={{
                      borderRadius: '0 0.5rem 0.5rem 0',
                      borderLeft: 'none',
                      borderColor: phoneCheck.status === 'available' ? '#22c55e' : phoneCheck.status === 'taken' ? '#ef4444' : undefined
                    }}
                  />
                </div>

                {/* Debounced live status indicator */}
                {phoneCheck.status === 'checking' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#d97706', fontWeight: 500 }}>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Checking phone availability (debounced)…</span>
                  </div>
                )}
                {phoneCheck.status === 'available' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                    <Check size={14} style={{ color: '#16a34a' }} />
                    <span>✓ Phone available for new worker enrollment</span>
                  </div>
                )}
                {phoneCheck.status === 'taken' && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>
                    <X size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
                    <span>⚠️ {phoneCheck.message}</span>
                  </div>
                )}

                {errors.phone && <span className="input-error"><AlertCircle size={12}/> {errors.phone.message}</span>}
              </div>

              <div className="input-wrapper">
                <label className="input-label">Gender <span className="required">*</span></label>
                <select {...register('gender')} className={`input ${errors.gender ? 'error' : ''}`}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <span className="input-error"><AlertCircle size={12}/> {errors.gender.message}</span>}
              </div>

              <div className="input-wrapper">
                <label className="input-label">Vehicle Number</label>
                <input {...register('vehicle_number')} className={`input ${errors.vehicle_number ? 'error' : ''}`} placeholder="JK02AB1234" />
                {errors.vehicle_number && <span className="input-error"><AlertCircle size={12}/> {errors.vehicle_number.message}</span>}
              </div>

              {/* District / Region */}
              <div className="input-wrapper">
                <label className="input-label">District <span className="required">*</span></label>
                <select {...register('district')} className={`input ${errors.district ? 'error' : ''}`}>
                  {districtOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {errors.district && <span className="input-error"><AlertCircle size={12}/> {errors.district.message}</span>}
              </div>

              {/* Area */}
              <div className="input-wrapper">
                <label className="input-label">Area <span className="required">*</span></label>
                <select {...register('area')} className={`input ${errors.area ? 'error' : ''}`}>
                  {areaOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {errors.area && <span className="input-error"><AlertCircle size={12}/> {errors.area.message}</span>}
              </div>

              {/* Experience */}
              <div className="input-wrapper">
                <label className="input-label">Experience (Years) <span className="required">*</span></label>
                <input {...register('experience_years')} type="number" min={0} max={50} className={`input ${errors.experience_years ? 'error' : ''}`} placeholder="0" />
                {errors.experience_years && <span className="input-error"><AlertCircle size={12}/> {errors.experience_years.message}</span>}
              </div>

              {/* Pincode */}
              <div className="input-wrapper">
                <label className="input-label">Pincode <span className="required">*</span></label>
                <input {...register('pincode')} className={`input ${errors.pincode ? 'error' : ''}`} readOnly />
                {errors.pincode && <span className="input-error"><AlertCircle size={12}/> {errors.pincode.message}</span>}
              </div>

              {/* Address */}
              <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Address <span className="required">*</span></label>
                <textarea {...register('address')} rows={3} className={`input ${errors.address ? 'error' : ''}`} placeholder="House no., lane, landmark…" style={{ resize: 'vertical' }} />
                {errors.address && <span className="input-error"><AlertCircle size={12}/> {errors.address.message}</span>}
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--gray-800)' }}>🔧 Skills / Services</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Select all skills this worker can do</p>
            {errors.skills && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}><AlertCircle size={14}/> {errors.skills.message}</div>}
            <Controller
              control={control}
              name="skills"
              render={({ field }) => (
                <div className="skills-selection-grid">
                  {skills.map(skill => {
                    const selected = field.value.includes(skill.id)
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          if (selected) field.onChange(field.value.filter((id: string) => id !== skill.id))
                          else field.onChange([...field.value, skill.id])
                        }}
                        style={{
                          padding: '0.625rem 0.75rem',
                          border: `1.5px solid ${selected ? 'var(--brand-500)' : 'var(--gray-200)'}`,
                          borderRadius: '0.5rem',
                          background: selected ? 'var(--brand-50)' : '#fff',
                          color: selected ? 'var(--brand-700)' : 'var(--gray-700)',
                          fontSize: '0.8rem',
                          fontWeight: selected ? 600 : 400,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 150ms ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>{skill.icon}</span>
                        <span>{skill.name}</span>
                        {selected && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>

          {/* Enrollment Info */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1.25rem', color: 'var(--gray-800)' }}>
              📋 Enrollment Details
            </h2>
            <div className="form-row-2col">
              <div className="input-wrapper">
                <label className="input-label">Phone Type <span className="required">*</span></label>
                <select {...register('phone_type')} className="input">
                  <option value="smartphone">📱 Smartphone</option>
                  <option value="keypad">📞 Keypad Phone</option>
                  <option value="none">❌ No Phone</option>
                </select>
              </div>

              <div className="input-wrapper">
                <label className="input-label">How Enrolled <span className="required">*</span></label>
                <select {...register('enrollment_method')} className="input">
                  <option value="field">🤝 Field Meeting</option>
                  <option value="self_call">📞 Direct Call</option>
                  <option value="employer">🏢 Through Contractor</option>
                  <option value="sms">💬 SMS Outreach</option>
                </select>
              </div>
            </div>

            <div className="input-wrapper" style={{ marginTop: '1rem' }}>
              <label className="input-label">Admin Notes <span style={{ color: 'var(--gray-400)' }}>(optional)</span></label>
              <textarea
                {...register('notes')}
                className="input"
                rows={3}
                placeholder="Any special notes about this worker…"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--gray-800)' }}>📷 Worker Photo</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button type="button" onClick={openCamera} disabled={isCameraLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1rem', border: '1.5px dashed var(--gray-300)', borderRadius: '0.625rem', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, color: 'var(--gray-700)', minWidth: 152 }}>
                {isCameraLoading ? 'Opening…' : 'Open Camera'}
              </button>

              <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1rem', border: '1.5px dashed var(--gray-300)', borderRadius: '0.625rem', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, color: 'var(--gray-700)', minWidth: 152 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => setPhotoPreview(String(reader.result))
                    reader.readAsDataURL(file)
                  }}
                  style={{ display: 'none' }}
                />
                Upload
              </label>
            </div>

            {cameraError && (
              <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                {cameraError}
              </div>
            )}

            {cameraOpen && (
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: '0.75rem', overflow: 'hidden', background: '#111827', marginBottom: '0.75rem' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 260, display: 'block', background: '#000' }} />
              </div>
            )}

            {cameraOpen && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <button type="button" onClick={captureCameraPhoto} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem 1.5rem', border: '1.5px solid var(--brand-500)', borderRadius: '0.625rem', background: '#eff6ff', cursor: 'pointer', fontWeight: 700, color: 'var(--brand-700)', minWidth: 180 }}>
                  Capture Photo
                </button>
              </div>
            )}

            {photoPreview && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <img src={photoPreview} alt="Worker preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '0.75rem', border: '1px solid var(--gray-200)' }} />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18 }} /> Enrolling…</>
            ) : (
              <><UserPlus size={18} /> Enroll Worker</>
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
