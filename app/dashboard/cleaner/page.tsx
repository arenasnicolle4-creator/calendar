'use client'
// app/dashboard/cleaner/page.tsx
// Cleaners use the same full calendar dashboard.
// Redirect there — role-based nav adjusts automatically.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function CleanerPortal() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard') }, [router])
  return <div style={{minHeight:'100vh',background:'#0d1f2d',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:24,height:24,border:'2px solid rgba(0,230,210,0.2)',borderTopColor:'#00e6d2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
}
