import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { logAdminAction } from '@/lib/auditLogger'
import { JAMMU_AREAS, JAMMU_DISTRICT_OPTIONS, getAreasForDistrict } from '@/lib/jammuCoordinates'
import { AlertCircle, CheckCircle, UserPlus, ArrowLeft, Sparkles, Check, X, Loader2, RefreshCw, UserCheck, Upload, Camera, Trash, User } from 'lucide-react'

// ── Validation Schema ─────────────────────────────────────────
const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian number')
const schema = z.object({
  name:              z.string().trim().min(2, 'Name is required').max(60),
  phone:             phoneSchema,
  email:             z.string().email('Invalid email address').optional().or(z.literal('')),
  gender:            z.enum(['male', 'female', 'other']),
  district:          z.string().trim().min(1, 'District is required'),
  area:              z.string().trim().min(2, 'Area is required'),
  pincode:           z.string().trim().min(3, 'Pincode is required'),
  address:           z.string().trim().min(5, 'Address is required'),
  status:            z.enum(['active', 'suspended']),
  preferred_channel: z.enum(['app', 'call', 'whatsapp', 'web']),
  notes:             z.string().max(300).optional(),
  photo_url:         z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface PhoneCheckState {
  status: 'idle' | 'checking' | 'available' | 'taken'
  message?: string
  existingUser?: any
}

const TEST_JAMMU_CUSTOMERS = [
  { name: 'Ananya Sharma', gender: 'female' as const, district: 'Jammu', area: 'Gandhi Nagar' },
  { name: 'Rahul Dogra', gender: 'male' as const, district: 'Jammu', area: 'Trikuta Nagar' },
  { name: 'Simran Kour', gender: 'female' as const, district: 'Jammu', area: 'Channi Himmat' },
  { name: 'Sahil Mahajan', gender: 'male' as const, district: 'Jammu', area: 'Bahu Fort' },
  { name: 'Pooja Jamwal', gender: 'female' as const, district: 'Jammu', area: 'Janipur' },
  { name: 'Rohit Verma', gender: 'male' as const, district: 'Jammu', area: 'Talab Tillo' },
  { name: 'Priya Slathia', gender: 'female' as const, district: 'Samba', area: 'Vijaypur' },
  { name: 'Zahid Lone', gender: 'male' as const, district: 'Udhampur', area: 'Main City' }
]

export function CustomerEnrollPage() {
  const { user: currentUser } = useAuth()
  const navigate        = useNavigate()
  const toast           = useToast()
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
    register, handleSubmit,
    formState: { errors }, watch, reset, setValue
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      gender: 'male',
      district: 'Jammu',
      area: 'Gandhi Nagar',
      pincode: '180004',
      address: '',
      status: 'active',
      preferred_channel: 'app',
      notes: '',
      photo_url: '',
    },
  })

  const watchedPhone = watch('phone')
  const selectedDistrict = watch('district')
  const selectedArea = watch('area')
  const districtOptions = JAMMU_DISTRICT_OPTIONS
  const areaOptions = useMemo(() => getAreasForDistrict(selectedDistrict || 'Jammu'), [selectedDistrict])

  // ── Debounced Phone Number Existence Check ───────────────────
  useEffect(() => {
    const rawPhone = (watchedPhone || '').trim()

    if (rawPhone.length < 10 || !/^[6-9]\d{9}$/.test(rawPhone)) {
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
            message: '✓ Phone number is available for new customer account'
          })
        }
      } catch (err: any) {
        console.error('Customer phone check error:', err)
        setPhoneCheck({ status: 'idle' })
      }
    }, 450)

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
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // ── Quick Test Data Generator ───────────────────────────────
  const handleQuickFillTest = useCallback(() => {
    const randomCustomer = TEST_JAMMU_CUSTOMERS[Math.floor(Math.random() * TEST_JAMMU_CUSTOMERS.length)]
    const randomPhone = '98' + Math.floor(10000000 + Math.random() * 90000000)
    const randomEmail = `${randomCustomer.name.toLowerCase().replace(/\s+/g, '.')}.${Math.floor(100 + Math.random() * 900)}@testjammu.in`

    const districtAreas = getAreasForDistrict(randomCustomer.district)
    const randomArea = districtAreas[Math.floor(Math.random() * districtAreas.length)] || randomCustomer.area
    const pincode = JAMMU_AREAS[randomArea]?.pincode || '180004'

    setValue('name', randomCustomer.name, { shouldValidate: true })
    setValue('phone', randomPhone, { shouldValidate: true })
    setValue('email', randomEmail, { shouldValidate: true })
    setValue('gender', randomCustomer.gender, { shouldValidate: true })
    setValue('district', randomCustomer.district, { shouldValidate: true })
    setValue('area', randomArea, { shouldValidate: true })
    setValue('pincode', pincode, { shouldValidate: true })
    setValue('address', `H.No. ${Math.floor(10 + Math.random() * 120)}, Sector ${Math.floor(1 + Math.random() * 6)}, Near Chowk, ${randomArea}`, { shouldValidate: true })
    setValue('status', 'active')
    setValue('preferred_channel', 'app')
    setValue('notes', `[Automated Customer Test Profile generated on ${new Date().toLocaleTimeString()}]`)

    toast.success(`Filled sample data for ${randomCustomer.name} (${randomPhone})!`)
  }, [setValue, toast])

  // ── 1-Click Automated Customer Enrollment Test ──────────────
  async function handleRunEnrollmentTest() {
    setTestRunning(true)
    handleQuickFillTest()

    setTimeout(async () => {
      try {
        await handleSubmit(onSubmit)()
      } catch (e) {
        console.error('Customer test run failed', e)
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
        video: { facingMode: 'user' },
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
      setCameraError('Camera permission was denied. Please use Upload or allow camera permissions.')
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
      // 1. Create user record
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .insert({
          phone: values.phone,
          email: values.email?.trim() || null,
          role: 'customer',
          status: values.status
        })
        .select('id')
        .single()

      if (userErr) throw userErr
      const userId = userData.id

      // 2. Create customer profile
      const profilePayload: Record<string, any> = {
        user_id: userId,
        name: values.name,
        area: values.area,
        city: values.district || 'Jammu',
        district: values.district,
        pincode: values.pincode,
        photo_url: photoPreview || values.photo_url || null,
      }

      const { error: profErr } = await supabase.from('profiles').insert(profilePayload)
      if (profErr) {
        console.error('Profile insert error:', profErr)
      }

      toast.success('Customer enrolled successfully!')

      logAdminAction({
        actor: currentUser,
        action: 'Customer Enrolled',
        targetType: 'customer',
        targetId: userId,
        details: `registered new customer "${values.name}" (+91 ${values.phone}) in ${values.area}, ${values.district}`,
      })

      setSuccess(true)
      reset()
      setPhotoPreview(null)
      setTimeout(() => navigate('/customers'), 1800)
    } catch (err: any) {
      console.error('Enroll customer error:', err)
      const msg = err.code === '23505' || err.message?.includes('23505') || err.message?.includes('users_phone_key')
        ? 'A customer with this phone number already exists.'
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-900)' }}>Customer Enrolled!</h2>
          <p style={{ color: 'var(--gray-500)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Account & profile created successfully. Redirecting to customers directory…
          </p>
        </div>
      </div>
    )
  }



  return (
    <div style={{ width: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Enroll Customer</h1>
          <p className="page-subtitle">Add a consumer account to the MistriJi Jammu & Kashmir platform</p>
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
            title="Populate realistic Jammu customer test data"
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
            title="Auto-fill and immediately enroll test customer"
          >
            <RefreshCw size={14} className={testRunning ? 'animate-spin' : ''} style={{ color: '#2563eb' }} />
            <span>{testRunning ? 'Testing…' : '🚀 Test Enroll Customer'}</span>
          </button>

          <Link
            to="/customers"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            <span>← Back to Customers</span>
          </Link>
        </div>
      </div>

      <div>
        {/* Main Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Personal Information */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1.25rem', color: 'var(--gray-800)' }}>
              👤 Personal & Location Details
            </h2>
            <div className="form-row-2col">
              {/* Name */}
              <div className="input-wrapper">
                <label className="input-label">Full Name <span className="required">*</span></label>
                <input {...register('name')} className={`input ${errors.name ? 'error' : ''}`} placeholder="Ananya Sharma, Rahul Dogra…" />
                {errors.name && <span className="input-error"><AlertCircle size={12}/> {errors.name.message}</span>}
              </div>

              {/* Phone with Debounced Check */}
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

                {/* Debounced live status */}
                {phoneCheck.status === 'checking' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#d97706', fontWeight: 500 }}>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Checking phone availability (debounced)…</span>
                  </div>
                )}
                {phoneCheck.status === 'available' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                    <Check size={14} style={{ color: '#16a34a' }} />
                    <span>✓ Phone available for new customer account</span>
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

              {/* Email */}
              <div className="input-wrapper">
                <label className="input-label">Email Address <span style={{ color: 'var(--gray-400)' }}>(optional)</span></label>
                <input {...register('email')} type="email" className={`input ${errors.email ? 'error' : ''}`} placeholder="customer@example.com" />
                {errors.email && <span className="input-error"><AlertCircle size={12}/> {errors.email.message}</span>}
              </div>

              {/* Gender */}
              <div className="input-wrapper">
                <label className="input-label">Gender <span className="required">*</span></label>
                <select {...register('gender')} className={`input ${errors.gender ? 'error' : ''}`}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <span className="input-error"><AlertCircle size={12}/> {errors.gender.message}</span>}
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

              {/* Pincode */}
              <div className="input-wrapper">
                <label className="input-label">Pincode <span className="required">*</span></label>
                <input {...register('pincode')} className={`input ${errors.pincode ? 'error' : ''}`} readOnly />
                {errors.pincode && <span className="input-error"><AlertCircle size={12}/> {errors.pincode.message}</span>}
              </div>

              {/* Account Status */}
              <div className="input-wrapper">
                <label className="input-label">Initial Account Status <span className="required">*</span></label>
                <select {...register('status')} className="input">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Address */}
              <div className="input-wrapper" style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Address / Landmark <span className="required">*</span></label>
                <textarea {...register('address')} rows={3} className={`input ${errors.address ? 'error' : ''}`} placeholder="House no., lane, landmark…" style={{ resize: 'vertical' }} />
                {errors.address && <span className="input-error"><AlertCircle size={12}/> {errors.address.message}</span>}
              </div>
            </div>
          </div>

          {/* Photo Upload / Camera */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1.25rem', color: 'var(--gray-800)' }}>📷 Customer Avatar / Photo</h2>
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{
                width: 110, height: 110, borderRadius: '50%', backgroundColor: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed #cbd5e1', overflow: 'hidden', flexShrink: 0,
                position: 'relative', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
              }}>
                {photoPreview ? (
                   <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                   <User size={38} color="#94a3b8" />
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                  <strong>Upload a clear photo of the customer.</strong> This helps technicians identify the customer and adds a layer of trust.
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, background: '#ffffff' }}>
                    <Upload size={15} /> Upload Image
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
                  </label>
                  
                  <button type="button" className="btn btn-secondary btn-sm" onClick={openCamera} disabled={isCameraLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, background: '#ffffff' }}>
                    <Camera size={15} /> {isCameraLoading ? 'Opening...' : 'Take Photo'}
                  </button>
                  
                  {photoPreview && (
                    <button type="button" className="btn btn-sm" onClick={() => setPhotoPreview(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', padding: '0.375rem 0.75rem' }}>
                      <Trash size={15} /> Remove
                    </button>
                  )}
                </div>

                {cameraError && (
                  <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    {cameraError}
                  </div>
                )}
              </div>
            </div>

            {cameraOpen && (
              <div style={{ marginTop: '1.25rem', border: '1px solid var(--gray-200)', borderRadius: '0.75rem', overflow: 'hidden', background: '#111827', position: 'relative' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 300, display: 'block', background: '#000', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                  <button type="button" onClick={captureCameraPhoto} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1.25rem', border: 'none', borderRadius: '2rem', background: '#2563eb', cursor: 'pointer', fontWeight: 700, color: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
                    📸 Capture Photo
                  </button>
                </div>
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
              <><span className="spinner" style={{ width: 18, height: 18 }} /> Enrolling Customer…</>
            ) : (
              <><UserPlus size={18} /> Enroll Customer</>
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
