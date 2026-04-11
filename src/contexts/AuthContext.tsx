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
  loading: boolean;
  login: (matricula: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('fundef_session');
    if (stored) {
      try {
        setProfessor(JSON.parse(stored));
      } catch {
        localStorage.removeItem('fundef_session');
      }
    }
    setLoading(false);
  }, []);

  const login = async (matricula: string, senha: string) => {
    const { data, error } = await supabase
      .from('professors')
      .select('id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role')
      .eq('matricula', matricula)
      .eq('senha', senha)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: 'Matrícula ou senha incorretos.' };
    }

    setProfessor(data);
    localStorage.setItem('fundef_session', JSON.stringify(data));
    return { success: true };
  };

  const logout = () => {
    setProfessor(null);
    localStorage.removeItem('fundef_session');
  };

  return (
    <AuthContext.Provider value={{ professor, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
