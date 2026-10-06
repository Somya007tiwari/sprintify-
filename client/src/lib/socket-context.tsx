'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-context';
import { setSocketIdForApi } from './api';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  socketId: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  socketId: null,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
        setSocketId(null);
        setSocketIdForApi(null);
      }
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const serverUrl = apiUrl.replace(/\/api\/?$/, '');

    const newSocket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setSocketId(newSocket.id || null);
      setSocketIdForApi(newSocket.id || null);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setSocketId(null);
      setSocketIdForApi(null);
    });

    newSocket.on('connect_error', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocketIdForApi(null);
    };
  }, [token, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected, socketId }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
