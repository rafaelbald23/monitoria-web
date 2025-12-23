import { useState, useEffect } from 'react';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CurrencyInput({ value, onChange, className = '', placeholder = 'R$ 0,00' }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  // Formata número para moeda brasileira
  const formatCurrency = (val: string): string => {
    // Remove tudo que não é número
    const numbers = val.replace(/\D/g, '');
    if (!numbers) return '';
    
    // Converte para centavos e depois para reais
    const cents = parseInt(numbers, 10);
    const reais = cents / 100;
    
    return reais.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Converte valor formatado para número
  const parseToNumber = (val: string): string => {
    const numbers = val.replace(/\D/g, '');
    if (!numbers) return '';
    return (parseInt(numbers, 10) / 100).toString();
  };

  useEffect(() => {
    if (value) {
      // Se já tem valor numérico, formata
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setDisplayValue(numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
      }
    } else {
      setDisplayValue('');
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatCurrency(inputValue);
    setDisplayValue(formatted);
    onChange(parseToNumber(inputValue));
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      inputMode="numeric"
    />
  );
}
