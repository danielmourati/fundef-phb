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

interface MatriculaOption {
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
  login: (cpf: string, senha: string) => Promise<{
    success: boolean;
    error?: string;
    multiple_matriculas?: boolean;
    matriculas?: MatriculaOption[];
  }>;
  loginAdmin: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  selectMatricula: (cpf: string, senha: string, matriculaId: string) => Promise<{ success: boolean; error?: string }>;
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

  // Login for professors (CPF + senha)
  const login = async (cpf: string, senha: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { cpf, senha, mode: 'professor' },
      });

      if (error) {
        return { success: false, error: 'Erro de conexão com o servidor.' };
      }

      // Multiple matrículas — return them for the UI to show selection
      if (data?.multiple_matriculas) {
        return {
          success: false,
          multiple_matriculas: true,
          matriculas: data.matriculas,
        };
      }

      if (!data?.professor) {
        return { success: false, error: data?.error || 'CPF ou senha incorretos.' };
      }

      setProfessor(data.professor);
      setToken(data.token);
      localStorage.setItem('fundef_session', JSON.stringify({ professor: data.professor, token: data.token }));
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  // Login for admin/juridico (email + senha)
  const loginAdmin = async (email: string, senha: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { email, senha, mode: 'admin' },
      });

      if (error || !data?.professor) {
        return { success: false, error: data?.error || 'E-mail ou senha incorretos.' };
      }

      setProfessor(data.professor);
      setToken(data.token);
      localStorage.setItem('fundef_session', JSON.stringify({ professor: data.professor, token: data.token }));
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  // Select a specific matrícula after multi-matrícula login
  const selectMatricula = async (cpf: string, senha: string, matriculaId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { cpf, senha, mode: 'professor', matricula_id: matriculaId },
      });

      if (error || !data?.professor) {
        return { success: false, error: data?.error || 'Erro ao selecionar matrícula.' };
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
    <AuthContext.Provider value={{ professor, token, loading, login, loginAdmin, selectMatricula, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
