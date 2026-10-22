import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Clock, CheckCircle, Shield } from 'lucide-react';
import usmcLogo from './usmc.png';

const API = `${import.meta.env.VITE_API_URL || 'https://api.usmarinelas.site'}/api`;

const api = async (ep, method, body, tok) => {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (tok) opts.headers['Authorization'] = `Bearer ${tok}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${ep}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Server returned an invalid response. Please try again.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

function toast(msg, isError) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;top:1rem;right:1rem;z-index:9999;padding:0.75rem 1.25rem;border-radius:8px;color:#fff;font-size:0.9rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideIn .3s ease;background:${isError ? '#dc2626' : '#16a34a'}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
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
  const [clearDur, setClearDur] = useState(0);
  const [appFee, setAppFee] = useState({ paymentMethod:'bank_transfer', cryptoNetwork:'BTC', receiptNumber:'', receiptImage:'' });
  const [appFeeProceed, setAppFeeProceed] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [appFeeAmount, setAppFeeAmount] = useState(239);
  const [supportMsg, setSupportMsg] = useState({ name:'', subject:'', message:'' });
  const [supportThread, setSupportThread] = useState([]);
  const [supportSent, setSupportSent] = useState(false);

  const [dues, setDues] = useState([]);
  const [duesBal, setDuesBal] = useState(0);
  const [selectedDue, setSelectedDue] = useState(null); // null = none, 'total' = pay all, or a bill object
  const [duesPayForm, setDuesPayForm] = useState({ paymentMethod:'bank_transfer', cryptoNetwork:'BTC', receiptNumber:'', receiptImage:'' });
  const [duesPayProceed, setDuesPayProceed] = useState(false);

  const [suspension, setSuspension] = useState(null);
  const [appealText, setAppealText] = useState('');
  const [appealReceipts, setAppealReceipts] = useState([]);
  const [clearancePayCfg, setClearancePayCfg] = useState({});
  const [clearanceFee, setClearanceFee] = useState(499);

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
      if (d.user.suspended) {
        try {
          const s = await api('/application/my-suspension', 'GET', null, token);
          setSuspension(s.suspension || null);
        } catch { setSuspension({ reason: d.user.suspensionReason, message: 'Your account has been suspended.' }); }
        try {
          const pc = await api('/application/clearance-payment-config', 'GET', null, token);
          setClearancePayCfg(pc.config || {});
          setClearanceFee(pc.clearanceFee || 499);
        } catch {}
      } else {
        setSuspension(null);
        const pc = await api('/application/payment-config', 'GET', null, token);
        setPaymentConfig(pc.config || {});
        setAppFeeAmount(pc.applicationFee || 239);
      }
      const sm = await api('/application/support-messages', 'GET', null, token);
      setSupportThread(sm.messages || []);

      try {
        const dr = await api('/application/dues', 'GET', null, token);
        setDues(dr.dues || []);
        setDuesBal(dr.balance || 0);
      } catch { setDues([]); setDuesBal(0); }
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
    const waiting = ['awaiting_payment_verification','awaiting_final_approval'];
    if (!waiting.includes(dash.stageStatus)) return;
    const t = setInterval(loadDash, 3000);
    return () => clearInterval(t);
  }, [dash?.stageStatus, loadDash]);

  const doLogout = () => { setUser(null); setToken(null); setDash(null); setSuspension(null); setStep(0); setForgotStep(0); localStorage.removeItem('token'); };

  const SUSPENSION_REASONS = {
    multiple_accounts: 'Multiple accounts detected',
    invalid_id: 'Invalid ID',
    idme_failed: 'IDME verification failed',
    unauthorized_disclosure: 'Unauthorized disclosure'
  };

  const SUSPENSION_MESSAGES = {
    multiple_accounts: 'We have detected that you are operating multiple accounts, which is a violation of our terms of service.',
    invalid_id: 'Your identification document was rejected during the verification process.',
    idme_failed: 'Your IDME verification has failed after multiple attempts.',
    unauthorized_disclosure: 'We discovered that you disclosed the process of this application to unauthorized persons, therefore you were banned. To lift this ban, you will have to pay a clearance fee of $499 to lift your suspension and avoid legal issues with our legal department.'
  };

  const submitAppeal = async () => {
    try {
      await api('/application/submit-appeal', 'POST', { reason: suspension?.reason, message: appealText }, token);
      setSuspension(s => ({ ...s, appealStatus: 'under_review', appealMessage: appealText }));
      toast('Appeal submitted successfully');
    } catch(e) { toast(e.message, true); }
  };

  const uploadAppealReceipts = async () => {
    if (appealReceipts.length === 0) return;
    try {
      const receipts = await Promise.all(appealReceipts.map(f => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = ev => resolve(ev.target.result);
        r.onerror = reject;
        r.readAsDataURL(f);
      })));
      const d = await api('/application/upload-appeal-receipts', 'POST', { receiptImages: receipts }, token);
      setSuspension(s => ({ ...s, appealStatus: 'receipts_submitted', clearanceInvoiceNumber: d.invoiceNumber }));
      setAppealReceipts([]);
      toast('Receipts uploaded successfully');
    } catch(e) { toast(e.message, true); }
  };

  const renderSuspension = () => {
    if (!suspension) return null;
    const reason = suspension.reason;
    const message = SUSPENSION_MESSAGES[reason] || suspension.message;
    const isDisclosure = reason === 'unauthorized_disclosure';
    const showAppealForm = !suspension.appealStatus || suspension.appealStatus === 'pending';

    return (
      <div className="form-card animate-fade-in" style={{ maxWidth: 650, margin: '2rem auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Shield size={32} color="#dc2626" />
          </div>
          <h2 className="section-title" style={{ color: '#dc2626', border: 'none' }}>Account Suspended</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Application ID: {dash?.applicationNumber || 'N/A'}</p>
        </div>

        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.5px' }}>Reason for suspension</p>
          <p style={{ color: '#991b1b', fontWeight: 500, marginBottom: '0.75rem' }}>{SUSPENSION_REASONS[reason] || reason}</p>
          <p style={{ color: '#7f1d1d', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
        </div>

        {isDisclosure && suspension.appealStatus !== 'receipts_submitted' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
              <p style={{ color: '#1e40af', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Clearance Fee: ${clearanceFee}</p>
              <p style={{ color: '#333', fontSize: '0.85rem', lineHeight: 1.5 }}>To lift your suspension, you must pay the clearance fee and upload your payment receipt(s) below.</p>
            </div>

            {clearancePayCfg.bankTransfer?.available && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333', marginBottom: '0.5rem' }}>Bank Transfer</p>
                <p style={{ fontSize: '0.8rem', color: '#555', lineHeight: 1.5 }}>Bank: {clearancePayCfg.bankTransfer.bankName}<br/>Account: {clearancePayCfg.bankTransfer.accountName}<br/>Number: {clearancePayCfg.bankTransfer.accountNumber}<br/>Routing: {clearancePayCfg.bankTransfer.routingNumber}</p>
                {clearancePayCfg.bankTransfer.instructions && <p style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.5rem' }}>{clearancePayCfg.bankTransfer.instructions}</p>}
              </div>
            )}

            {clearancePayCfg.crypto?.available && clearancePayCfg.crypto.assets?.map(a => (
              <div key={a.network} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333', marginBottom: '0.75rem' }}>Crypto — {a.network}</p>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {a.qrCodeImage && <img src={a.qrCodeImage} alt="QR" style={{ width: 110, height: 110, borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ fontSize: '0.78rem', color: '#555', marginBottom: '0.35rem' }}>Wallet Address:</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0f0f0', borderRadius: 6, padding: '0.45rem 0.65rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', flex: 1 }}>{a.walletAddress}</span>
                      <button onClick={() => copyToClipboard(a.walletAddress)} style={{ flexShrink: 0, background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: 5, padding: '0.25rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>Copy</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#333', marginBottom: '0.5rem' }}>Upload Receipt(s)</label>
              <input type="file" accept="image/*" multiple onChange={e => setAppealReceipts([...e.target.files])} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
              {appealReceipts.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  {appealReceipts.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <span>{f.name}</span>
                      <button onClick={() => setAppealReceipts(appealReceipts.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
                    </div>
                  ))}
                  <button onClick={uploadAppealReceipts} className="btn btn-primary" style={{ width: 'auto', marginTop: '0.5rem', padding: '0.5rem 1.5rem' }}>Upload {appealReceipts.length} Receipt(s)</button>
                </div>
              )}
            </div>
          </div>
        )}

        {isDisclosure && suspension.appealStatus === 'receipts_submitted' && (
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#065f46', fontWeight: 600 }}>Receipts submitted successfully</p>
            <p style={{ color: '#065f46', fontSize: '0.85rem', marginTop: '0.25rem' }}>Invoice: {suspension.clearanceInvoiceNumber || 'N/A'} &mdash; Our team will review your payment.</p>
          </div>
        )}

        {!isDisclosure && showAppealForm && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#333', marginBottom: '0.5rem' }}>Appeal Message</label>
            <textarea className="form-textarea" rows={4} placeholder="Explain why you believe this suspension is in error..." value={appealText} onChange={e => setAppealText(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.88rem' }} />
            <button onClick={submitAppeal} className="btn btn-primary" style={{ width: 'auto', marginTop: '0.75rem', padding: '0.5rem 1.5rem' }} disabled={!appealText.trim()}>Submit Appeal</button>
          </div>
        )}

        {!isDisclosure && suspension.appealStatus === 'under_review' && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#92400e', fontWeight: 600 }}>Appeal under review</p>
            <p style={{ color: '#92400e', fontSize: '0.85rem', marginTop: '0.25rem' }}>Your appeal has been submitted. Our team will review it and contact you.</p>
          </div>
        )}

        <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={doLogout} className="btn btn-secondary" style={{ padding: '0.5rem 2rem' }}>Sign Out</button>
        </div>
      </div>
    );
  };

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

  const selectDuration = async (dur) => {
    setError(''); setLoading(true);
    try {
      const d = await api('/application/stage2-clearance', 'POST', { duration: dur }, token);
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

  const handleDuesReceiptFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('Receipt image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setDuesPayForm(p => ({ ...p, receiptImage: reader.result }));
    reader.readAsDataURL(f);
  };

  const submitDuesPayment = async () => {
    if (!duesPayForm.receiptImage) { setError('Upload your payment receipt image'); return; }
    if (!selectedDue) { setError('No bill selected'); return; }
    setError(''); setLoading(true);
    try {
      if (selectedDue === 'total') {
        await api('/application/dues/pay-total', 'POST', duesPayForm, token);
      } else {
        await api(`/application/dues/${selectedDue.id}/pay`, 'POST', duesPayForm, token);
      }
      toast('Payment receipt submitted! Awaiting admin review.');
      await loadDash();
      setSelectedDue(null);
      setDuesPayForm({ paymentMethod:'bank_transfer', cryptoNetwork:'BTC', receiptNumber:'', receiptImage:'' });
      setDuesPayProceed(false);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const renderDuesAlert = () => {
    if (!dash || !dash.duesAlertActive || duesBal <= 0) return null;
    const unpaidCount = dues.filter(d => d.status !== 'paid').length;
    const alertMsg = dash.duesAlertMessage || '';
    // Build the ticker text: repeat so the scroll never gaps
    const tickerText = [
      `OUTSTANDING BALANCE: $${duesBal.toFixed(2)}`,
      unpaidCount > 0 ? `${unpaidCount} UNPAID BILL${unpaidCount > 1 ? 'S' : ''}` : '',
      alertMsg ? alertMsg.toUpperCase() : '',
      `TOTAL DUES: $${duesBal.toFixed(2)}`,
    ].filter(Boolean).join('   \u2022   ');
    const repeated = `${tickerText}     \u00A0\u00A0\u00A0\u00A0     ${tickerText}`;

    return (
      <div style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #6d28d9)', borderRadius: 10, marginBottom: '1.25rem', overflow: 'hidden', boxShadow: '0 3px 14px rgba(109,40,217,0.35)', display: 'flex', alignItems: 'stretch' }}>
        {/* Scrolling ticker */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '0.85rem 0', position: 'relative' }}>
          <style>{`
            @keyframes tickerScroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .dues-ticker-inner {
              display: inline-block;
              white-space: nowrap;
              animation: tickerScroll 22s linear infinite;
              color: #fff;
              font-size: 0.88rem;
              font-weight: 600;
              letter-spacing: 0.4px;
            }
          `}</style>
          <div className="dues-ticker-inner">{repeated}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{repeated}</div>
        </div>
        {/* Pay Now button */}
        <button
          onClick={() => setStep(300)}
          style={{ flexShrink: 0, background: '#fff', color: '#4f46e5', border: 'none', borderRadius: '0 10px 10px 0', padding: '0 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', borderLeft: '2px solid rgba(255,255,255,0.25)' }}
        >
          Pay Now &rsaquo;
        </button>
      </div>
    );
  };

  const renderPayDues = () => {
    const bank = paymentConfig?.bankTransfer || {};
    const crypto = paymentConfig?.crypto || {};
    const availableAssets = (crypto.assets || []).filter(a => a.available);
    const activeDuesNetwork = availableAssets.find(a => a.network === duesPayForm.cryptoNetwork)
      ? duesPayForm.cryptoNetwork : (availableAssets[0]?.network || '');
    const selectedAsset = availableAssets.find(a => a.network === activeDuesNetwork) || null;
    const methodList = [];
    if (bank.available) methodList.push({ id: 'bank_transfer', label: 'Bank Transfer' });
    availableAssets.forEach(a => methodList.push({ id: `crypto_${a.network}`, label: `Crypto (${a.network})` }));

    const unpaidDues = dues.filter(d => d.status !== 'paid');
    const pendingDues = dues.filter(d => d.pendingPaymentId);
    const payableNow = unpaidDues.filter(d => !d.pendingPaymentId);
    const totalBilled = dues.reduce((s, d) => s + (d.amount || 0), 0);
    const totalPaid = dues.reduce((s, d) => s + (d.amountPaid || 0), 0);

    const payLabel = selectedDue === 'total'
      ? `Total Outstanding — $${duesBal.toFixed(2)}`
      : selectedDue ? `${selectedDue.label} — $${parseFloat((selectedDue.amount - (selectedDue.amountPaid || 0)).toFixed(2)).toFixed(2)}`
      : '';

    const resetPay = () => { setSelectedDue(null); setDuesPayForm({ paymentMethod:'bank_transfer', cryptoNetwork:'BTC', receiptNumber:'', receiptImage:'' }); setDuesPayProceed(false); setError(''); };

    return (
      <div className="form-card animate-fade-in" style={{ maxWidth: 720, margin: '1rem auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="section-title" style={{ margin: 0, border: 'none' }}>My Dues &amp; Payments</h2>
          <button onClick={() => { setStep(100); resetPay(); }} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Back</button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            ['Total Billed', `$${totalBilled.toFixed(2)}`, '#1e40af', '#dbeafe'],
            ['Total Paid',   `$${totalPaid.toFixed(2)}`,  '#16a34a', '#d1fae5'],
            ['Balance Due',  `$${duesBal.toFixed(2)}`,    duesBal > 0 ? '#dc2626' : '#16a34a', duesBal > 0 ? '#fee2e2' : '#d1fae5'],
          ].map(([label, val, color, bg]) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: '0.9rem 1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{label}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Pay Total button — only when there are payable (non-pending) unpaid bills */}
        {payableNow.length > 0 && !selectedDue && (
          <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>Pay Total Outstanding</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                {payableNow.length} bill{payableNow.length > 1 ? 's' : ''} — <strong style={{ color: '#fff' }}>${duesBal.toFixed(2)}</strong>
              </p>
            </div>
            <button
              onClick={() => { setSelectedDue('total'); setDuesPayForm({ paymentMethod: bank.available ? 'bank_transfer' : (availableAssets.length ? 'crypto' : 'bank_transfer'), cryptoNetwork: activeDuesNetwork, receiptNumber:'', receiptImage:'' }); setDuesPayProceed(false); setError(''); }}
              style={{ background: '#fff', color: '#4f46e5', border: 'none', borderRadius: 7, padding: '0.55rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Pay ${duesBal.toFixed(2)} Now
            </button>
          </div>
        )}

        {/* Bills breakdown */}
        {dues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>No bills on your account.</div>
        ) : (
          <div style={{ marginBottom: selectedDue ? '1.5rem' : 0 }}>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', fontWeight: 600 }}>Bill Breakdown</p>
            {dues.map(d => {
              const balance = parseFloat((d.amount - (d.amountPaid || 0)).toFixed(2));
              const isPending = !!d.pendingPaymentId;
              const isSelected = selectedDue && selectedDue !== 'total' && selectedDue.id === d.id;
              const borderColor = d.status === 'paid' ? '#a7f3d0' : isPending ? '#fde68a' : '#fecaca';
              return (
                <div key={d.id} style={{ background: isSelected ? '#eff6ff' : '#fff', border: `1px solid ${isSelected ? 'var(--primary-blue)' : borderColor}`, borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '0.6rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', transition: 'all 0.15s' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: '0.15rem', fontSize: '0.95rem' }}>{d.label}</p>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.3rem' }}>
                      {d.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} &bull; {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', gap: '1.1rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#1e40af' }}>Billed: <strong>${d.amount.toFixed(2)}</strong></span>
                      {(d.amountPaid || 0) > 0 && <span style={{ color: '#16a34a' }}>Paid: <strong>${(d.amountPaid).toFixed(2)}</strong></span>}
                      {balance > 0 && <span style={{ color: '#dc2626' }}>Owed: <strong>${balance.toFixed(2)}</strong></span>}
                    </div>
                    {isPending && <p style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.3rem', fontWeight: 600 }}>Receipt submitted — awaiting admin review</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <span style={{ padding: '0.18rem 0.6rem', borderRadius: 50, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                      background: d.status === 'paid' ? '#d1fae5' : isPending ? '#fef3c7' : d.status === 'partial' ? '#fef9c3' : '#fee2e2',
                      color: d.status === 'paid' ? '#065f46' : isPending ? '#92400e' : d.status === 'partial' ? '#854d0e' : '#991b1b' }}>
                      {d.status === 'paid' ? 'Paid' : isPending ? 'Pending' : d.status === 'partial' ? 'Partial' : 'Unpaid'}
                    </span>
                    {d.status !== 'paid' && !isPending && !selectedDue && (
                      <button
                        onClick={() => { setSelectedDue(d); setDuesPayForm({ paymentMethod: bank.available ? 'bank_transfer' : (availableAssets.length ? 'crypto' : 'bank_transfer'), cryptoNetwork: activeDuesNetwork, receiptNumber:'', receiptImage:'' }); setDuesPayProceed(false); setError(''); }}
                        className="btn btn-primary" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>
                        Pay
                      </button>
                    )}
                    {isSelected && (
                      <button onClick={resetPay} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.1rem', padding: '0 0.25rem' }}>&times;</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment form — shown when a due or total is selected */}
        {selectedDue && (
          <div className="animate-fade-in" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '1.25rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '1rem', marginBottom: '0.2rem' }}>
                  {selectedDue === 'total' ? 'Pay Total Outstanding Balance' : `Pay: ${selectedDue.label}`}
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#555' }}>
                  Amount due: <strong style={{ color: '#dc2626', fontSize: '1rem' }}>${selectedDue === 'total' ? duesBal.toFixed(2) : parseFloat((selectedDue.amount - (selectedDue.amountPaid || 0)).toFixed(2)).toFixed(2)}</strong>
                  {selectedDue === 'total' && payableNow.length > 0 && (
                    <span style={{ fontSize: '0.78rem', color: '#6b7280', marginLeft: '0.5rem' }}>({payableNow.length} bill{payableNow.length > 1 ? 's' : ''})</span>
                  )}
                </p>
              </div>
              <button onClick={resetPay} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#6b7280', padding: '0 0.25rem' }}>&times;</button>
            </div>

            {/* Paying total: show bill list being covered */}
            {selectedDue === 'total' && payableNow.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Bills covered by this payment</p>
                {payableNow.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.2rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#333' }}>{d.label}</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>${parseFloat((d.amount - (d.amountPaid || 0)).toFixed(2)).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '2px solid #e5e7eb' }}>
                  <span>Total</span><span style={{ color: '#dc2626' }}>${duesBal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {methodList.length === 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ color: '#92400e', fontWeight: 600 }}>No payment methods configured yet. Contact support.</p>
              </div>
            )}

            {/* Method selector */}
            {methodList.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Select Payment Method</p>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {methodList.map(m => {
                    const active = m.id === 'bank_transfer'
                      ? duesPayForm.paymentMethod === 'bank_transfer'
                      : duesPayForm.paymentMethod === 'crypto' && activeDuesNetwork === m.id.replace('crypto_', '');
                    return (
                      <button key={m.id} className="btn" style={{ background: active ? 'var(--primary-blue)' : 'white', color: active ? 'white' : '#333', border: active ? '2px solid var(--primary-blue)' : '1px solid #cbd5e1', fontWeight: 600, fontSize: '0.85rem' }}
                        onClick={() => m.id === 'bank_transfer' ? setDuesPayForm(p => ({ ...p, paymentMethod: 'bank_transfer' })) : setDuesPayForm(p => ({ ...p, paymentMethod: 'crypto', cryptoNetwork: m.id.replace('crypto_', '') }))}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bank transfer details */}
            {duesPayForm.paymentMethod === 'bank_transfer' && bank.available && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#333', lineHeight: 1.85 }}>
                <p style={{ fontWeight: 700, color: 'var(--primary-blue)', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Bank Transfer Details</p>
                <p><strong>Bank:</strong> {bank.bankName}</p>
                <p><strong>Account Name:</strong> {bank.accountName}</p>
                <p><strong>Account Number:</strong> {bank.accountNumber}</p>
                {bank.routingNumber && <p><strong>Routing:</strong> {bank.routingNumber}</p>}
                {bank.swiftCode && <p><strong>SWIFT:</strong> {bank.swiftCode}</p>}
                {bank.instructions && <p style={{ color: '#555', marginTop: '0.5rem', fontSize: '0.84rem' }}>{bank.instructions}</p>}
              </div>
            )}

            {/* Crypto details */}
            {duesPayForm.paymentMethod === 'crypto' && crypto.available && selectedAsset && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 700, color: 'var(--primary-blue)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Crypto — {selectedAsset.network}</p>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {selectedAsset.qrCodeImage && <img src={selectedAsset.qrCodeImage} alt="QR" style={{ width: 130, height: 130, borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.4rem' }}>Wallet Address:</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f3f4f6', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', flex: 1 }}>{selectedAsset.walletAddress}</span>
                      <button onClick={() => copyToClipboard(selectedAsset.walletAddress)} style={{ flexShrink: 0, background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: 5, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Copy</button>
                    </div>
                    {crypto.instructions && <p style={{ color: '#555', fontSize: '0.82rem', marginTop: '0.6rem' }}>{crypto.instructions}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Upload receipt */}
            {methodList.length > 0 && !duesPayProceed && (
              <button onClick={() => setDuesPayProceed(true)} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                Proceed to Upload Receipt <ChevronRight size={16} />
              </button>
            )}

            {duesPayProceed && (
              <div className="animate-fade-in" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #bfdbfe' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Upload Payment Receipt</p>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <input type="file" accept="image/*" className="form-input" onChange={handleDuesReceiptFile} style={{ padding: '0.5rem' }} />
                </div>
                {duesPayForm.receiptImage && <img src={duesPayForm.receiptImage} alt="Receipt preview" style={{ maxWidth: 260, maxHeight: 260, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: '0.75rem', display: 'block' }} />}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Reference / Transaction Number (optional)</label>
                  <input type="text" className="form-input" placeholder="Enter reference number" value={duesPayForm.receiptNumber} onChange={e => setDuesPayForm(p => ({ ...p, receiptNumber: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setDuesPayProceed(false)} className="btn btn-secondary">Back</button>
                  <button onClick={submitDuesPayment} className="btn btn-primary" disabled={loading || !duesPayForm.receiptImage}>
                    {loading ? 'Submitting...' : `Submit Receipt for $${selectedDue === 'total' ? duesBal.toFixed(2) : parseFloat((selectedDue.amount - (selectedDue.amountPaid||0)).toFixed(2)).toFixed(2)}`}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderProgress = (cur) => (
    <div className="progress-container">
      {[1,2,3].map(n => (
        <div key={n} className={`progress-step ${cur > n ? 'completed' : cur === n ? 'active' : ''}`}>{n}</div>
      ))}
    </div>
  );

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast('Address copied!')).catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      toast('Address copied!');
    });
  };

  const renderPaymentStage = () => {
    const bank = paymentConfig?.bankTransfer || {};
    const crypto = paymentConfig?.crypto || {};
    const allAssets = crypto.assets || [];
    const availableAssets = allAssets.filter(a => a.available);

    // Default to first available network if current selection isn't available
    const activeNetwork = availableAssets.find(a => a.network === appFee.cryptoNetwork)
      ? appFee.cryptoNetwork
      : (availableAssets[0]?.network || '');

    const selectedAsset = availableAssets.find(a => a.network === activeNetwork) || null;
    const appNumber = dash?.applicationNumber || '';
    const invNumber = dash?.invoiceNumber || (appNumber ? `INV-${appNumber.replace('USMC-', '')}` : '');
    const methodLabel = appFee.paymentMethod === 'crypto' ? `Crypto (${selectedAsset?.network || activeNetwork})` : 'Bank Transfer';

    const methodList = [];
    if (bank.available) methodList.push({ id: 'bank_transfer', label: 'Bank Transfer', sub: bank.bankName || 'Wire payment to our bank account' });
    availableAssets.forEach(a => methodList.push({ id: `crypto_${a.network}`, label: `Crypto (${a.network})`, sub: 'Pay with cryptocurrency' }));

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
                const active = m.id === 'bank_transfer'
                  ? appFee.paymentMethod === 'bank_transfer'
                  : appFee.paymentMethod === 'crypto' && activeNetwork === m.id.replace('crypto_', '');
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
            <h3 style={{ color: 'var(--primary-blue)', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', marginBottom: '0.75rem' }}>Crypto Details — {selectedAsset.network}</h3>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {selectedAsset.qrCodeImage && <img src={selectedAsset.qrCodeImage} alt={`${selectedAsset.network} QR`} style={{ width: 160, height: 160, borderRadius: 8, border: '1px solid #e5e7eb' }} />}
              <div style={{ fontSize: '0.9rem', color: '#333', lineHeight: 1.8, flex: 1, minWidth: 220 }}>
                <p><strong>Network:</strong> {selectedAsset.network}</p>
                <p style={{ marginBottom: '0.4rem' }}><strong>Wallet Address:</strong></p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f3f4f6', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', flex: 1 }}>{selectedAsset.walletAddress}</span>
                  <button onClick={() => copyToClipboard(selectedAsset.walletAddress)} title="Copy address" style={{ flexShrink: 0, background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: 5, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Copy</button>
                </div>
                {crypto.instructions && <p style={{ color: '#555', marginTop: '0.75rem', fontSize: '0.85rem' }}>{crypto.instructions}</p>}
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
    if (dash?.suspended) return renderSuspension();

    const stage = dash?.currentStage || 1;
    const status = dash?.stageStatus || '';

    if (dash?.finalApproved) {
      return (
        <div>
        {renderDuesAlert()}
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

    if (status === 'rejected') {
      return (
        <div className="form-card animate-fade-in">
          <h2 className="section-title">Leave Request Declined</h2>
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#991b1b', fontWeight: 600 }}>Your leave request was not approved.</p>
            {dash.finalRejectMessage && <p style={{ color: '#991b1b', marginTop: '0.5rem' }}>{dash.finalRejectMessage}</p>}
          </div>
          <p style={{ marginBottom: '1.5rem', color: '#555' }}>If you believe this is a mistake, contact your unit administrator or submit a support request.</p>
          <button onClick={() => setStep(200)} className="btn btn-primary">Contact Support <ChevronRight size={16} /></button>
        </div>
      );
    }

    if (status === 'awaiting_final_approval') {
      return (<div className="form-card animate-fade-in" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}><CheckCircle size={48} color="#2563eb" style={{ margin: '0 auto 1rem' }} /><h2 className="section-title" style={{ border: 'none' }}>Awaiting Final Approval</h2><p style={{ fontSize: '0.95rem', color: '#555', maxWidth: 500, margin: '0 auto' }}>All verifications complete. Awaiting final admin approval.</p></div>);
    }

    return (
      <div>
        {renderDuesAlert()}
        <div className="form-card">
        {renderProgress(stage)}
        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem' }}>{error}</div>}

        {stage === 1 && renderPaymentStage()}

        {stage === 2 && (
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

        {step === 300 && renderPayDues()}

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
