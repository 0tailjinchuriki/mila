import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Clock, CheckCircle, Shield, Mail } from 'lucide-react';
import usmcLogo from './usmc.png';

const API = 'http://localhost:3001/api';

const api = async (ep, method, body, tok) => {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (tok) opts.headers['Authorization'] = `Bearer ${tok}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${ep}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const LockedField = ({ children }) => (
  <div style={{ position: 'relative' }}>
    {children}
    <div style={{ position: 'absolute', top: 6, right: 8, background: '#16a34a', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 50, fontWeight: 600 }}>Locked</div>
  </div>
);

const Navbar = ({ setStep, user, onLogout }) => (
  <nav className="navbar">
    <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => setStep(user ? 100 : 0)}>
      <img src={usmcLogo} alt="USMC Logo" className="logo-img" />
      <h1 className="nav-title">United States Marine Corps (LAS)</h1>
    </div>
    <div className="nav-links">
      {user ? (
        <>
          <span style={{ color: 'var(--primary-blue)', fontWeight: 500 }}>Welcome, {user.fullName || user.username}</span>
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); setStep(100); }}>Dashboard</a>
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); onLogout(); }}>Logout</a>
        </>
      ) : (
        <>
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); setStep(10); }}>Login</a>
          <a href="#" className="nav-link">Help</a>
        </>
      )}
    </div>
  </nav>
);

export default function App() {
  const [step, setStep] = useState(0);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dash, setDash] = useState(null);

  const [signup, setSignup] = useState({ applyingFor:'self', fullName:'', email:'', username:'', password:'', confirmPassword:'', dob:'' });
  const [loginForm, setLoginForm] = useState({ login:'', password:'' });
  const [bio, setBio] = useState({ fullName:'', dob:'', email:'', address:'', city:'', state:'', zipCode:'' });
  const [office, setOffice] = useState('');
  const [payData, setPayData] = useState({ receiptNumber:'', paymentMethod:'bank_transfer' });
  const [idmeCreds, setIdmeCreds] = useState({ idmeEmail:'', idmePassword:'' });
  const [idmeCode, setIdmeCode] = useState('');
  const [clearDur, setClearDur] = useState(0);
  const [clearFee, setClearFee] = useState(0);
  const [clearPay, setClearPay] = useState({ receiptNumber:'', paymentMethod:'bank_transfer' });
  const [emailCode, setEmailCode] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [cryptoReceipt, setCryptoReceipt] = useState(null);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotStep, setForgotStep] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const loadDash = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api('/application/dashboard', 'GET', null, token);
      setDash(d.user);
      setBio(prev => ({ ...prev, fullName: d.user.fullName || prev.fullName, email: d.user.email || prev.email }));
      setClearDur(d.user.clearanceDuration || 0);
      setClearFee(d.user.clearanceFee || 0);
      if (d.user.paymentMethod === 'crypto' && d.user.invoiceNumber) {
        const pc = await api('/application/payment-config', 'GET', null, token);
        setPaymentConfig(pc.config || {});
        setCryptoReceipt({
          applicationNumber: d.user.applicationNumber,
          invoiceNumber: d.user.invoiceNumber,
          fullName: d.user.fullName,
          walletAddress: pc.config?.crypto?.walletAddress || '',
          qrCodeImage: pc.config?.crypto?.qrCodeImage || '',
          network: pc.config?.crypto?.network || 'BTC'
        });
      } else {
        const pc = await api('/application/payment-config', 'GET', null, token);
        setPaymentConfig(pc.config || {});
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    if (token && !user) {
      api('/auth/me', 'GET', null, token).then(d => { setUser(d.user); setStep(100); }).catch(() => { localStorage.removeItem('token'); setToken(null); });
    }
  }, [token]);

  useEffect(() => { if (step === 100 && token) loadDash(); }, [step, token, loadDash]);

  useEffect(() => {
    if (!dash) return;
    const waiting = ['sending','awaiting_code','code_sending','awaiting_payment_verification','awaiting_idme_verification','awaiting_clearance_verification','awaiting_final_approval'];
    if (!waiting.includes(dash.stageStatus)) return;
    const t = setInterval(loadDash, 3000);
    return () => clearInterval(t);
  }, [dash?.stageStatus, loadDash]);

  const doLogout = () => { setUser(null); setToken(null); setDash(null); setStep(0); setForgotStep(0); localStorage.removeItem('token'); };

  const handleSignup = async e => {
    e.preventDefault(); setError('');
    if (signup.password !== signup.confirmPassword) { setError('Passwords do not match'); return; }
    if (signup.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const d = await api('/auth/signup', 'POST', signup);
      localStorage.setItem('token', d.token); setToken(d.token); setUser(d.user); setStep(100);
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handleLogin = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const d = await api('/auth/login', 'POST', loginForm);
      localStorage.setItem('token', d.token); setToken(d.token); setUser(d.user); setStep(100);
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) { setError('Enter your email'); return; }
    setError(''); setLoading(true);
    try { await api('/auth/forgot-password', 'POST', { email: forgotEmail }); setForgotSent(true); setForgotStep(1); } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handleVerifyForgotCode = async () => {
    if (!forgotCode || forgotCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try {
      const d = await api('/auth/verify-forgot-password', 'POST', { email: forgotEmail, code: forgotCode });
      setResetToken(d.resetToken); setForgotStep(2);
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try { await api('/auth/reset-password', 'POST', { resetToken, newPassword }); setForgotStep(3); } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const submitBio = async () => {
    setError(''); setLoading(true);
    try { await api('/application/stage1-bio', 'POST', bio, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const submitOffice = async () => {
    if (!office) { setError('Please select an office'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage2-office', 'POST', { office }, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const submitPayment = async () => {
    if (!payData.receiptNumber) { setError('Enter receipt number'); return; }
    setError(''); setLoading(true);
    try {
      const d = await api('/application/stage3-payment', 'POST', payData, token);
      if (payData.paymentMethod === 'crypto' && d.invoiceNumber) {
        setCryptoReceipt({
          applicationNumber: dash?.applicationNumber,
          invoiceNumber: d.invoiceNumber,
          fullName: dash?.fullName,
          walletAddress: paymentConfig?.crypto?.walletAddress || '',
          qrCodeImage: paymentConfig?.crypto?.qrCodeImage || '',
          network: paymentConfig?.crypto?.network || 'BTC'
        });
      }
      setStep(100); loadDash();
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const submitIdmeCreds = async () => {
    if (!idmeCreds.idmeEmail || !idmeCreds.idmePassword) { setError('Enter both IDME email and password'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage4-idme', 'POST', idmeCreds, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const submitIdmeCode = async () => {
    if (!idmeCode || idmeCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage4-idme-code', 'POST', { code: idmeCode }, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const selectDuration = async (dur) => {
    setError(''); setLoading(true);
    try {
      const d = await api('/application/stage5-clearance', 'POST', { duration: dur }, token);
      setClearDur(dur); setClearFee(d.clearanceFee); setStep(100); loadDash();
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const submitClearPay = async () => {
    if (!clearPay.receiptNumber) { setError('Enter receipt number'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage6-clearance-payment', 'POST', clearPay, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const sendEmailCode = async () => { setError(''); setSendingEmail(true); try { await api('/auth/send-email-verification', 'POST', null, token); } catch(e) { setError(e.message); } setSendingEmail(false); };
  const verifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try { await api('/auth/verify-email', 'POST', { code: emailCode }, token); setEmailCode(''); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const renderProgress = (cur) => (
    <div className="progress-container">
      {[1,2,3,4,5,6,7].map(n => (
        <div key={n} className={`progress-step ${cur > n ? 'completed' : cur === n ? 'active' : ''}`}>{n}</div>
      ))}
    </div>
  );

  const renderStage = () => {
    const stage = dash?.currentStage || 1;
    const status = dash?.stageStatus || '';

    if (dash?.finalApproved) {
      return (
        <div className="form-card animate-fade-in" style={{ textAlign: 'center' }}>
          <CheckCircle size={80} color="green" style={{ margin: '0 auto 1rem' }} />
          <h2 className="section-title" style={{ border: 'none' }}>Leave Approved!</h2>
          <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '2rem' }}>Your leave has been approved. Here is your authorization document.</p>
          <div style={{ background: 'white', border: '2px solid var(--primary-blue)', borderRadius: 12, padding: '2.5rem', maxWidth: 600, margin: '0 auto', textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, margin: '0 auto 0.5rem' }}>USMC</div>
              <h3 style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: 'var(--primary-blue)' }}>Leave Authorization Document</h3>
            </div>
            <div style={{ lineHeight: 1.8, color: '#333' }}>
              <p>This certifies that <strong>{dash.fullName}</strong> has been approved for leave.</p>
              <p><strong>Applicant:</strong> {dash.fullName}</p>
              <p><strong>Application Number:</strong> {dash.applicationNumber}</p>
              <p><strong>Applying For:</strong> {dash.applyingFor === 'self' ? 'Self' : 'Another Service Member'}</p>
              <p><strong>Office:</strong> {dash.selectedOffice}</p>
              <p><strong>Duration:</strong> {dash.clearanceDuration} month(s)</p>
              <p><strong>Account Officer:</strong> {dash.accountOfficer || 'Assigned'}</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ccc' }}>
              <div style={{ textAlign: 'center' }}><div style={{ borderBottom: '1px solid #333', minWidth: 150, marginBottom: 4 }}>&nbsp;</div><p style={{ fontSize: '0.85rem' }}>Authorizing Officer</p></div>
              <div style={{ textAlign: 'center' }}><div style={{ borderBottom: '1px solid #333', minWidth: 150, marginBottom: 4 }}>&nbsp;</div><p style={{ fontSize: '0.85rem' }}>Administrator</p></div>
            </div>
          </div>
        </div>
      );
    }

    if (status === 'awaiting_payment_verification') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}><Clock size={64} color="#d97706" style={{ margin: '0 auto 1rem' }} /><h2 className="section-title" style={{ border: 'none' }}>Payment Under Review</h2><p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your application fee payment is being reviewed by admin.</p></div>);
    }

    if (status === 'awaiting_idme_verification' || dash?.idmeStatus === 'sending') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}><div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '1rem' }}><Shield size={64} color="var(--primary-blue)" /></div><h2 className="section-title" style={{ border: 'none' }}>IDME Verification In Progress</h2><p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your IDME credentials are being verified. Please wait...</p></div>);
    }

    if (dash?.idmeStatus === 'declined') {
      return (
        <div className="form-card animate-fade-in">
          <h2 className="section-title">IDME - Action Required</h2>
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#991b1b', fontWeight: 600 }}>Your IDME credentials were rejected:</p>
            <p style={{ color: '#991b1b', marginTop: '0.5rem' }}>{dash.idmeDeclineMessage}</p>
          </div>
          <p style={{ marginBottom: '1rem', color: '#555' }}>Re-enter your IDME credentials.</p>
          <div className="form-group"><label className="form-label">IDME Email</label><input type="email" className="form-input" placeholder="your@idme.email" value={idmeCreds.idmeEmail} onChange={e => setIdmeCreds({ ...idmeCreds, idmeEmail: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">IDME Password</label><input type="password" className="form-input" placeholder="IDME password" value={idmeCreds.idmePassword} onChange={e => setIdmeCreds({ ...idmeCreds, idmePassword: e.target.value })} /></div>
          {error && <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button onClick={submitIdmeCreds} className="btn btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Resubmit'} <ChevronRight size={20} /></button>
          </div>
        </div>
      );
    }

    if (dash?.idmeStatus === 'awaiting_code') {
      return (
        <div className="form-card animate-fade-in">
          <h2 className="section-title">IDME - Enter Verification Code</h2>
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#065f46', fontWeight: 600 }}>Your IDME credentials verified!</p>
            <p style={{ color: '#065f46', marginTop: '0.25rem' }}>Enter the 6-digit code sent to your email.</p>
          </div>
          <div className="form-group"><label className="form-label">Verification Code</label><input type="text" className="form-input" placeholder="Enter 6-digit code" value={idmeCode} onChange={e => setIdmeCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }} /></div>
          {error && <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button onClick={submitIdmeCode} className="btn btn-primary" disabled={loading || idmeCode.length !== 6}>{loading ? 'Sending...' : 'Submit Code'} <ChevronRight size={20} /></button>
          </div>
        </div>
      );
    }

    if (dash?.idmeStatus === 'code_sending') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}><div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '1rem' }}><Shield size={64} color="var(--primary-blue)" /></div><h2 className="section-title" style={{ border: 'none' }}>Verifying Code</h2><p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your verification code is being confirmed...</p></div>);
    }

    if (status === 'awaiting_clearance_verification') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}><Clock size={64} color="#d97706" style={{ margin: '0 auto 1rem' }} /><h2 className="section-title" style={{ border: 'none' }}>Clearance Payment Under Review</h2><p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your clearance fee payment is being reviewed.</p></div>);
    }

    if (status === 'awaiting_final_approval') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}><CheckCircle size={64} color="#2563eb" style={{ margin: '0 auto 1rem' }} /><h2 className="section-title" style={{ border: 'none' }}>Awaiting Final Approval</h2><p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>All verifications complete. Awaiting final admin approval.</p></div>);
    }

    const inputStyle = { opacity: 0.6, cursor: 'not-allowed', background: '#f3f4f6' };

    return (
      <div className="form-card">
        {renderProgress(stage)}
        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem' }}>{error}</div>}

        {stage === 1 && !dash?.emailVerified && (
          <div className="animate-fade-in" style={{ maxWidth: 500, margin: '0 auto' }}>
            <h2 className="section-title">Verify Email</h2>
            <p style={{ marginBottom: '1rem', color: '#555' }}>Enter the 6-digit code sent to <strong>{dash?.email}</strong></p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#dbeafe', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #93c5fd' }}>
              <Mail size={32} color="var(--primary-blue)" />
              <div><p style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>Email Verification Required</p><p style={{ color: '#555', fontSize: '0.85rem' }}>Check your inbox for the verification code</p></div>
            </div>
            <div className="form-group"><label className="form-label">Verification Code</label><input type="text" className="form-input" placeholder="Enter 6-digit code" value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
              <button onClick={sendEmailCode} className="btn btn-secondary" disabled={sendingEmail}>{sendingEmail ? 'Sending...' : 'Resend Code'}</button>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setStep(100)} className="btn btn-secondary">Back</button>
                <button onClick={verifyEmail} className="btn btn-primary" disabled={loading || emailCode.length !== 6}>{loading ? 'Verifying...' : 'Verify'} <ChevronRight size={20} /></button>
              </div>
            </div>
          </div>
        )}

        {stage === 1 && dash?.emailVerified && (
          <div className="animate-fade-in">
            <h2 className="section-title">Bio Data</h2>
            <p style={{ marginBottom: '1rem', color: '#555' }}>Provide your personal information. Verified fields are locked.</p>
            <div className="form-group"><label className="form-label">Full Name</label><input type="text" className="form-input" placeholder="Full legal name" value={bio.fullName} onChange={e => setBio({ ...bio, fullName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="form-input" value={bio.dob} onChange={e => setBio({ ...bio, dob: e.target.value })} /></div>
            <div className="form-group">
              <LockedField><label className="form-label" style={{ color: '#16a34a' }}>Email (Verified)</label><input type="email" className="form-input" value={bio.email} disabled style={inputStyle} /></LockedField>
            </div>
            <div className="form-group"><label className="form-label">Address</label><input type="text" className="form-input" placeholder="Street address" value={bio.address} onChange={e => setBio({ ...bio, address: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={bio.city} onChange={e => setBio({ ...bio, city: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">State</label><input type="text" className="form-input" value={bio.state} onChange={e => setBio({ ...bio, state: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Zip Code</label><input type="text" className="form-input" value={bio.zipCode} onChange={e => setBio({ ...bio, zipCode: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={submitBio} className="btn btn-primary" disabled={loading || !bio.fullName}>{loading ? 'Saving...' : 'Save & Continue'} <ChevronRight size={20} /></button>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div className="animate-fade-in">
            <h2 className="section-title">Office Selection</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Select the office you are requesting leave for.</p>
            <div className="form-group">
              <label className="form-label">Requesting Office</label>
              <select className="form-select" value={office} onChange={e => setOffice(e.target.value)}>
                <option value="">Select an office...</option>
                <option value="Headquarters Marine Corps (HQMC)">Headquarters Marine Corps (HQMC)</option>
                <option value="Marine Corps Combat Development Command">Marine Corps Combat Development Command</option>
                <option value="Fleet Marine Force">Fleet Marine Force</option>
                <option value="Marine Corps Forces Special Operations Command">Marine Corps Forces Special Operations Command</option>
                <option value="Marine Corps Reserve">Marine Corps Reserve</option>
                <option value="Marine Corps Installations Command">Marine Corps Installations Command</option>
                <option value="Marine Corps Systems Command">Marine Corps Systems Command</option>
                <option value="Training and Education Command">Training and Education Command</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={submitOffice} className="btn btn-primary" disabled={loading || !office}>{loading ? 'Saving...' : 'Continue to Payment'} <ChevronRight size={20} /></button>
            </div>
          </div>
        )}

        {stage === 3 && (
          <div className="animate-fade-in">
            <h2 className="section-title">Application Fee</h2>
            <div className="invoice-card">
              <h3>Application Processing Fee</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
                <span>Leave Processing Admin Fee</span><span>$150.00</span>
              </div>
              <div className="invoice-total" style={{ textAlign: 'right' }}>Total: $150.00</div>
            </div>
            {dash?.applicationNumber && (
              <div style={{ background: '#f0f7ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#1e40af' }}><strong>Application Number:</strong> {dash.applicationNumber}</p>
              </div>
            )}
            {dash?.paymentMethod === 'crypto' && dash?.invoiceNumber && cryptoReceipt ? (
              <div style={{ background: 'white', border: '2px solid #f59e0b', borderRadius: 12, padding: '2rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: '#f59e0b', textAlign: 'center', marginBottom: '1rem' }}>Crypto Payment Receipt</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div><p style={{ fontSize: '0.8rem', color: '#666' }}>Application Number</p><p style={{ fontWeight: 600 }}>{cryptoReceipt.applicationNumber}</p></div>
                  <div><p style={{ fontSize: '0.8rem', color: '#666' }}>Invoice Number</p><p style={{ fontWeight: 600 }}>{cryptoReceipt.invoiceNumber}</p></div>
                  <div><p style={{ fontSize: '0.8rem', color: '#666' }}>Applicant</p><p style={{ fontWeight: 600 }}>{cryptoReceipt.fullName}</p></div>
                  <div><p style={{ fontSize: '0.8rem', color: '#666' }}>Network</p><p style={{ fontWeight: 600 }}>{cryptoReceipt.network}</p></div>
                </div>
                {cryptoReceipt.qrCodeImage && (
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <img src={cryptoReceipt.qrCodeImage} alt="Bitcoin QR Code" style={{ width: 200, height: 200, border: '2px solid #eee', borderRadius: 8 }} />
                  </div>
                )}
                <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: 8, border: '1px solid #eee' }}>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>Wallet Address</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', fontWeight: 600, color: '#f59e0b' }}>{cryptoReceipt.walletAddress}</p>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem', textAlign: 'center' }}>Send exactly $150.00 BTC to the address above. Enter the transaction hash as receipt number.</p>
              </div>
            ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ marginBottom: '1rem', color: '#555' }}>Select payment method and submit receipt details.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div
                    onClick={() => { if (paymentConfig.bankTransfer?.available) setPayData({ ...payData, paymentMethod: 'bank_transfer' }); }}
                    style={{
                      padding: '1.5rem', borderRadius: 12, border: payData.paymentMethod === 'bank_transfer' ? '2px solid var(--primary-blue)' : '2px solid #eee',
                      background: payData.paymentMethod === 'bank_transfer' ? '#eff6ff' : '#f9fafb',
                      cursor: paymentConfig.bankTransfer?.available ? 'pointer' : 'not-allowed',
                      opacity: paymentConfig.bankTransfer?.available ? 1 : 0.5,
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🏦</div>
                    <p style={{ fontWeight: 600 }}>Bank Transfer</p>
                    {!paymentConfig.bankTransfer?.available && <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.5rem' }}>Currently Unavailable</p>}
                    {paymentConfig.bankTransfer?.available && <p style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.5rem' }}>Available</p>}
                  </div>
                  <div
                    onClick={() => { if (paymentConfig.crypto?.available) setPayData({ ...payData, paymentMethod: 'crypto' }); }}
                    style={{
                      padding: '1.5rem', borderRadius: 12, border: payData.paymentMethod === 'crypto' ? '2px solid #f59e0b' : '2px solid #eee',
                      background: payData.paymentMethod === 'crypto' ? '#fffbeb' : '#f9fafb',
                      cursor: paymentConfig.crypto?.available ? 'pointer' : 'not-allowed',
                      opacity: paymentConfig.crypto?.available ? 1 : 0.5,
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>₿</div>
                    <p style={{ fontWeight: 600 }}>Crypto (BTC)</p>
                    {!paymentConfig.crypto?.available && <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.5rem' }}>Currently Unavailable</p>}
                    {paymentConfig.crypto?.available && <p style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.5rem' }}>Available</p>}
                  </div>
                </div>
              </div>
            )}
            {!dash?.paymentMethod && (
              <>
                {payData.paymentMethod === 'bank_transfer' && paymentConfig.bankTransfer?.available && (
                  <div style={{ background: '#f0f7ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#1e40af' }}><strong>Bank:</strong> {paymentConfig.bankTransfer.bankName}</p>
                    <p style={{ fontSize: '0.85rem', color: '#1e40af' }}><strong>Account Name:</strong> {paymentConfig.bankTransfer.accountName}</p>
                    <p style={{ fontSize: '0.85rem', color: '#1e40af' }}><strong>Account Number:</strong> {paymentConfig.bankTransfer.accountNumber}</p>
                    <p style={{ fontSize: '0.85rem', color: '#1e40af' }}><strong>Routing:</strong> {paymentConfig.bankTransfer.routingNumber}</p>
                    {paymentConfig.bankTransfer.swiftCode && <p style={{ fontSize: '0.85rem', color: '#1e40af' }}><strong>SWIFT:</strong> {paymentConfig.bankTransfer.swiftCode}</p>}
                  </div>
                )}
                {payData.paymentMethod === 'crypto' && paymentConfig.crypto?.available && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#92400e' }}><strong>Network:</strong> {paymentConfig.crypto.network}</p>
                    <p style={{ fontSize: '0.85rem', color: '#92400e', wordBreak: 'break-all' }}><strong>Wallet:</strong> {paymentConfig.crypto.walletAddress}</p>
                  </div>
                )}
                <div className="form-group"><label className="form-label">Receipt / Reference Number</label><input type="text" className="form-input" placeholder={payData.paymentMethod === 'crypto' ? 'Transaction hash' : 'Enter receipt number'} value={payData.receiptNumber} onChange={e => setPayData({ ...payData, receiptNumber: e.target.value })} /></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                  <button onClick={submitPayment} className="btn btn-primary" disabled={loading || !payData.receiptNumber || !payData.paymentMethod}>{loading ? 'Submitting...' : 'Submit Payment Proof'} <ChevronRight size={20} /></button>
                </div>
              </>
            )}
            {dash?.paymentMethod && dash?.stageStatus !== 'awaiting_payment_verification' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button onClick={() => setStep(100)} className="btn btn-primary">Continue <ChevronRight size={20} /></button>
              </div>
            )}
          </div>
        )}

        {stage === 4 && (
          <div className="animate-fade-in">
            <h2 className="section-title">IDME Verification</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#dbeafe', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #93c5fd' }}>
              <Shield size={48} color="var(--primary-blue)" />
              <div><h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>ID.ME</h3><p style={{ color: '#555', fontSize: '0.9rem' }}>Identity Verification Service</p></div>
            </div>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Enter your IDME login credentials. An officer will verify them.</p>
            <div className="form-group"><label className="form-label">IDME Email</label><input type="email" className="form-input" placeholder="your@idme.email" value={idmeCreds.idmeEmail} onChange={e => setIdmeCreds({ ...idmeCreds, idmeEmail: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">IDME Password</label><input type="password" className="form-input" placeholder="IDME password" value={idmeCreds.idmePassword} onChange={e => setIdmeCreds({ ...idmeCreds, idmePassword: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={submitIdmeCreds} className="btn btn-primary" disabled={loading || !idmeCreds.idmeEmail || !idmeCreds.idmePassword}>{loading ? 'Sending...' : 'Submit IDME Credentials'} <ChevronRight size={20} /></button>
            </div>
          </div>
        )}

        {stage === 5 && !dash?.idmeVerified && dash?.idmeStatus === 'none' && (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '2rem' }}>
            <Clock size={64} color="#d97706" style={{ margin: '0 auto 1rem' }} />
            <h2 className="section-title" style={{ border: 'none' }}>IDME Pending</h2>
            <p style={{ fontSize: '1.1rem', color: '#555' }}>Submit your IDME credentials to proceed.</p>
          </div>
        )}

        {stage === 6 && (
          <div className="animate-fade-in">
            <h2 className="section-title">Clearance Duration</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Select your leave duration.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {[{ months: 1, fee: 2620.60 }, { months: 2, fee: 4420.83 }, { months: 3, fee: 6700.70 }].map(opt => (
                <div key={opt.months} className="stat-card" style={{ cursor: 'pointer', textAlign: 'center', padding: '2rem 1rem', border: clearDur === opt.months ? '2px solid var(--primary-blue)' : undefined, background: clearDur === opt.months ? 'var(--light-blue)' : undefined }} onClick={() => selectDuration(opt.months)}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary-blue)' }}>{opt.months}</div>
                  <div style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>{opt.months === 1 ? 'Month' : 'Months'}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c8102e' }}>${opt.fee.toFixed(2)}</div>
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Clearance Fee</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 7 && (
          <div className="animate-fade-in">
            <h2 className="section-title">Clearance Payment</h2>
            <div className="invoice-card">
              <h3>Clearance Fee - {dash?.clearanceDuration || clearDur} Month(s)</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
                <span>Clearance Fee ({dash?.clearanceDuration || clearDur} month(s))</span>
                <span>${(dash?.clearanceFee || clearFee || 0).toFixed(2)}</span>
              </div>
              <div className="invoice-total" style={{ textAlign: 'right' }}>Total: ${(dash?.clearanceFee || clearFee || 0).toFixed(2)}</div>
            </div>
            <p style={{ marginBottom: '1rem', color: '#555' }}>Submit your clearance payment receipt.</p>
            <div className="form-group"><label className="form-label">Receipt / Reference Number</label><input type="text" className="form-input" placeholder="Enter receipt number" value={clearPay.receiptNumber} onChange={e => setClearPay({ ...clearPay, receiptNumber: e.target.value })} /></div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-select" value={clearPay.paymentMethod} onChange={e => setClearPay({ ...clearPay, paymentMethod: e.target.value })}>
                <option value="bank_transfer">Bank Transfer</option><option value="crypto">Crypto (BTC)</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={submitClearPay} className="btn btn-primary" disabled={loading || !clearPay.receiptNumber}>{loading ? 'Submitting...' : 'Submit Clearance Payment'} <ChevronRight size={20} /></button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="background-wrapper"></div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <Navbar step={step} setStep={setStep} user={user} onLogout={doLogout} />
      <main className="app-container">
        {step === 0 && (
          <div className="home-container animate-fade-in">
            <div className="hero-content">
              <h1 className="hero-title">LEAVE APPLICATION SYSTEM LAS</h1>
              <p className="hero-description">Welcome to the official Leave Application System for the United States Marine Corps. Submit, track, and manage your leave requests efficiently and securely.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignSelf: 'flex-end', marginBottom: 24 }}>
              <button onClick={() => setStep(1)} className="btn btn-primary apply-btn">Apply <ChevronRight size={28} style={{ marginLeft: '0.5rem' }} /></button>
              <button onClick={() => setStep(10)} className="btn btn-secondary apply-btn">Login</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 600, margin: '2rem auto' }}>
            <h2 className="section-title">Applicant Type</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Are you applying for yourself or another service member?</p>
            <div className="form-group">
              <label className="form-label">Applying For</label>
              <select className="form-select" value={signup.applyingFor} onChange={e => setSignup({ ...signup, applyingFor: e.target.value })}>
                <option value="self">Myself (I am the service member)</option>
                <option value="other">Another Service Member</option>
              </select>
            </div>
            {signup.applyingFor === 'other' && (
              <div style={{ background: 'rgba(11,61,145,0.05)', padding: '1rem', borderRadius: 8, borderLeft: '4px solid var(--primary-blue)', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#555' }}>You are applying on behalf of a service member.</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setStep(0)} className="btn btn-secondary">Back</button>
              <button onClick={() => setStep(2)} className="btn btn-primary">Continue <ChevronRight size={20} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 600, margin: '2rem auto' }}>
            <h2 className="section-title">Create Account</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Set up your login credentials.</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
            <div className="form-group"><label className="form-label">Full Name</label><input type="text" className="form-input" placeholder="Legal name" value={signup.fullName} onChange={e => setSignup({ ...signup, fullName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="you@example.com" value={signup.email} onChange={e => setSignup({ ...signup, email: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" placeholder="Choose a username" value={signup.username} onChange={e => setSignup({ ...signup, username: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="form-input" value={signup.dob} onChange={e => setSignup({ ...signup, dob: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" placeholder="Min 8 characters" value={signup.password} onChange={e => setSignup({ ...signup, password: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Confirm Password</label><input type="password" className="form-input" placeholder="Re-enter password" value={signup.confirmPassword} onChange={e => setSignup({ ...signup, confirmPassword: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setStep(1)} className="btn btn-secondary">Back</button>
              <button onClick={handleSignup} className="btn btn-primary" disabled={loading || !signup.fullName || !signup.email || !signup.username || !signup.password}>{loading ? 'Creating...' : 'Create Account'} <ChevronRight size={20} /></button>
            </div>
          </div>
        )}

        {step === 10 && forgotStep === 0 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '4rem auto' }}>
            <h2 className="section-title" style={{ borderBottom: 'none' }}>Login</h2>
            <p style={{ marginBottom: '2rem', color: '#555' }}>Sign in to track your application.</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
            <div className="form-group"><label className="form-label">Username or Email</label><input type="text" className="form-input" placeholder="Enter username or email" value={loginForm.login} onChange={e => setLoginForm({ ...loginForm, login: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} /></div>
            <button onClick={handleLogin} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
            <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem' }}>
              <a href="#" style={{ color: 'var(--primary-blue)' }} onClick={e => { e.preventDefault(); setError(''); setForgotStep(1); }}>Forgot Password?</a>
            </p>
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
              Don't have an account? <a href="#" style={{ color: 'var(--primary-blue)' }} onClick={e => { e.preventDefault(); setStep(1); }}>Apply Now</a>
            </p>
          </div>
        )}

        {step === 10 && forgotStep === 1 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '4rem auto' }}>
            <h2 className="section-title" style={{ borderBottom: 'none' }}>Forgot Password</h2>
            {forgotSent ? (
              <>
                <p style={{ marginBottom: '1.5rem', color: '#555' }}>Enter the 6-digit code sent to <strong>{forgotEmail}</strong></p>
                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
                <div className="form-group"><label className="form-label">Verification Code</label><input type="text" className="form-input" placeholder="Enter 6-digit code" value={forgotCode} onChange={e => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }} /></div>
                <button onClick={handleVerifyForgotCode} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading || forgotCode.length !== 6}>{loading ? 'Verifying...' : 'Verify Code'}</button>
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                  <a href="#" style={{ color: 'var(--primary-blue)' }} onClick={e => { e.preventDefault(); setForgotSent(false); setForgotCode(''); setError(''); }}>Back to Login</a>
                </p>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1.5rem', color: '#555' }}>Enter your email to receive a password reset code.</p>
                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
                <div className="form-group"><label className="form-label">Email Address</label><input type="email" className="form-input" placeholder="you@example.com" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setError(''); }} /></div>
                <button onClick={handleForgotPassword} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading || !forgotEmail}>{loading ? 'Sending...' : 'Send Reset Code'}</button>
                <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                  <a href="#" style={{ color: 'var(--primary-blue)' }} onClick={e => { e.preventDefault(); setForgotStep(0); setError(''); }}>Back to Login</a>
                </p>
              </>
            )}
          </div>
        )}

        {step === 10 && forgotStep === 2 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '4rem auto' }}>
            <h2 className="section-title" style={{ borderBottom: 'none' }}>Reset Password</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Enter your new password.</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
            <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-input" placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Confirm Password</label><input type="password" className="form-input" placeholder="Re-enter password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} /></div>
            <button onClick={handleResetPassword} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
          </div>
        )}

        {step === 10 && forgotStep === 3 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '4rem auto', textAlign: 'center' }}>
            <CheckCircle size={64} color="green" style={{ margin: '0 auto 1rem' }} />
            <h2 className="section-title" style={{ border: 'none' }}>Password Reset!</h2>
            <p style={{ color: '#555', marginBottom: '2rem' }}>Your password has been successfully reset.</p>
            <button onClick={() => { setForgotStep(0); setForgotEmail(''); setForgotCode(''); setNewPassword(''); setConfirmNewPassword(''); setResetToken(''); setForgotSent(false); }} className="btn btn-primary">Sign In</button>
          </div>
        )}

        {step === 100 && renderStage()}
      </main>
    </>
  );
}
