import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

export function unwrap(response) {
  return response.data.data;
}

export function currency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function date(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : 'Never';
}
