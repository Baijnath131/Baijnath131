import React, { useState, useEffect } from "react";
const API = "http://localhost:4000/api";
export default function App() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const login = async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      loadDoctors();
      loadAppointments(data.user.id);
    } else alert(data.error);
  };
 const loadDoctors = async () => {
    const res = await fetch(`${API}/users/doctors`);
    setDoctors(await res.json());
  };
  const loadAppointments = async (uid) => {
    const res = await fetch(`${API}/appointments/user/${uid}`);
    setAppointments(await res.json());
  };

  const bookAppointment = async (doctorId) => {
    const datetime = new Date().toISOString();
    const res = await fetch(`${API}/appointments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: user.id, doctorId, datetime, reason: "Checkup" })
    });
    const data = await res.json();
    alert("Appointment booked with " + doctorId);
    loadAppointments(user.id);
  };

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-xl mb-4">Healthcare Login</h1>
        <input placeholder="Email" className="border p-2 mr-2"
          value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" type="password" className="border p-2 mr-2"
          value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <button className="bg-blue-500 text-white p-2" onClick={login}>Login</button>
        <p className="mt-2">Demo: patient@example.com / patient123</p>
      </div>
    );
  }
  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Welcome {user.name} ({user.role})</h1>

      <h2 className="text-xl mt-4 mb-2">Your Appointments</h2>
      <ul className="mb-4">
        {appointments.map(a => (
          <li key={a.id} className="border p-2 my-1">
            {a.datetime} with {a.doctorId} — {a.status}
          </li>
        ))}
      </ul>
      {user.role === "patient" && (
        <>
          <h2 className="text-xl mb-2">Available Doctors</h2>
          {doctors.map(d => (
            <div key={d.id} className="border p-2 my-1 flex justify-between">
              <span>{d.name} ({d.email})</span>
              <button className="bg-green-500 text-white px-3 py-1"
                onClick={() => bookAppointment(d.id)}>Book</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
