import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { installLiveAutoCapitalization } from '@/lib/live-auto-capitalization';

// This harness has no backend, router or cloud SDK: all values are local state.
// It verifies that document-capture formatting works with React-controlled inputs.
function Harness() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [bookingAddress, setBookingAddress] = useState('');
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [reference, setReference] = useState('');
  const [template, setTemplate] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => installLiveAutoCapitalization(document), []);
  return <main>
    <h1>Live Auto Capitalization QA</h1>
    <label>Nama Tamu <input id="synthetic-name" value={name} onChange={e => setName(e.target.value)} /></label>
    <output data-testid="name-state">{name}</output>
    <label>Alamat <input id="synthetic-address" value={address} onChange={e => setAddress(e.target.value)} /></label>
    <output data-testid="address-state">{address}</output>
    <label>Alamat Booking <input value={bookingAddress} onChange={e => setBookingAddress(e.target.value)} /></label>
    <output data-testid="booking-address-state">{bookingAddress}</output>
    <label>Catatan <textarea value={note} onChange={e => setNote(e.target.value)} /></label>
    <output data-testid="note-state">{note}</output>
    <label>Nomor WhatsApp <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
    <output data-testid="phone-state">{phone}</output>
    <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <output data-testid="email-state">{email}</output>
    <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    <output data-testid="password-state">{password}</output>
    <label>Cari Tamu <input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <output data-testid="search-state">{search}</output>
    <label>Referensi Transfer <input value={reference} onChange={e => setReference(e.target.value)} /></label>
    <output data-testid="reference-state">{reference}</output>
    <label>Teks WhatsApp <textarea id="wa-template-body" value={template} onChange={e => setTemplate(e.target.value)} /></label>
    <output data-testid="template-state">{template}</output>
    <label>Kode Rahasia <input data-auto-capitalize="off" value={code} onChange={e => setCode(e.target.value)} /></label>
    <output data-testid="code-state">{code}</output>
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing synthetic root');
createRoot(root).render(<Harness />);
