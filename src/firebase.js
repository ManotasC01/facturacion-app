import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXg-vPtZdTmQK_kmDT75gJ9BFxw10Tx3Q",
  authDomain: "transacciones-c41b2.firebaseapp.com",
  projectId: "transacciones-c41b2",
  storageBucket: "transacciones-c41b2.firebasestorage.app",
  messagingSenderId: "200081306122",
  appId: "1:200081306122:web:ce66e7af49dbea570de5f3",
  measurementId: "G-GWP3QENYLM",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const clientesRef = collection(db, "clientes");

export function escucharClientes(callback) {
  return onSnapshot(clientesRef, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export async function guardarCliente(cliente) {
  const { id, ...data } = cliente;
  await setDoc(doc(db, "clientes", id), data);
}

export async function eliminarCliente(id) {
  await deleteDoc(doc(db, "clientes", id));
}

export async function actualizarCliente(id, data) {
  await updateDoc(doc(db, "clientes", id), data);
}
