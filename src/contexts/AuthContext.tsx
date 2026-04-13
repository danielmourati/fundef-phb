import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Professor {
  id: string;
  nome: string;
  cpf: string;
  matricula: string;
  data_nascimento: string | null;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  total_cotas: number | null;
  status: string;
  role: string;
}

interface AuthContextType {
  professor: Professor | null;
  token: string | null;
  loading: boolean;
  login: (matricula: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('fundef_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate token expiry client-side
        const payloadB64 = parsed.token?.split('.')[0];
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64));
          if (payload.exp > Date.now()) {
            setProfessor(parsed.professor);
            setToken(parsed.token);
          } else {
            localStorage.removeItem('fundef_session');
          }
        }
      } catch {
        localStorage.removeItem('fundef_session');
      }
    }
    setLoading(false);
  }, []);

  const login = async (matricula: string, senha: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { matricula, senha },
      });

      if (error || !data?.professor) {
        return { success: false, error: data?.error || 'Matrícula ou senha incorretos.' };
      }

      setProfessor(data.professor);
      setToken(data.token);
      localStorage.setItem('fundef_session', JSON.stringify({ professor: data.professor, token: data.token }));
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const logout = () => {
    setProfessor(null);
    setToken(null);
    localStorage.removeItem('fundef_session');
  };

  return (
    <AuthContext.Provider value={{ professor, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
