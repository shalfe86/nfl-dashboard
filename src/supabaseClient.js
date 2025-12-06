import { createClient } from '@supabase/supabase-js'

// --- FILL THESE IN WITH YOUR REAL KEYS ---
// Go to Supabase Dashboard -> Connect (top right) -> App Frameworks -> React
// OR: Settings (Gear) -> API

const supabaseUrl = 'https://tvjklvwddqzpkgtkpixm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2amtsdndkZHF6cGtndGtwaXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5ODg2MTIsImV4cCI6MjA4MDU2NDYxMn0.2COKzfi_tSC0bt7LH8uuhGADQCaSmevGEkAHi60LRfU'

export const supabase = createClient(supabaseUrl, supabaseKey)