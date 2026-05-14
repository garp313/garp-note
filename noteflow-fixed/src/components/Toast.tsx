'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  key: number;
}

export function Toast({ message, key: k }: ToastProps) {
  if (!message) return null;
  return (
    <div key={k} className="toast">{message}</div>
  );
}
