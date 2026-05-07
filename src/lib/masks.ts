// Máscaras e validações de input

export const maskCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

export const unmaskCPF = (value: string) => value.replace(/\D/g, '');

export const isValidCPF = (value: string): boolean => {
  const cpf = unmaskCPF(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i++) {
      total += parseInt(cpf[i]) * (factor - i);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calc(10) === parseInt(cpf[9]) && calc(11) === parseInt(cpf[10]);
};

// Máscara DD/MM/YYYY (aceita ISO YYYY-MM-DD como entrada)
export const maskDate = (value: string) => {
  if (!value) return '';
  // Normaliza ISO (YYYY-MM-DD) para DD/MM/YYYY
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const isValidDate = (value: string): boolean => {
  if (!value) return true; // opcional
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [, dd, mm, yyyy] = m;
  const d = parseInt(dd), mo = parseInt(mm), y = parseInt(yyyy);
  if (mo < 1 || mo > 12) return false;
  const dim = new Date(y, mo, 0).getDate();
  if (d < 1 || d > dim) return false;
  if (y < 1900 || y > 2100) return false;
  return true;
};

// Telefone BR: (00) 0000-0000 ou (00) 00000-0000
export const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const maskMonthYear = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const isValidMonthYear = (value: string): boolean => {
  if (!value) return true;
  const m = value.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const mo = parseInt(m[1]), y = parseInt(m[2]);
  return mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100;
};
