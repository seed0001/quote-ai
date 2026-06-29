import React, { useState } from 'react';
import { Calculator as CalcIcon, Copy, Check } from 'lucide-react';

export default function Calculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [copied, setCopied] = useState(false);

  const handleNum = (num) => {
    if (display === '0' || display === 'Error') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleEqual = () => {
    if (!equation) return;
    try {
      const fullEqu = equation + display;
      // Use clean mathematical evaluation safely without raw eval
      // Since it's mathematical characters only, we can replace operations
      // and compute. To be extremely safe, we filter characters.
      const sanitized = fullEqu.replace(/[^0-9\s.+\-*/]/g, '');
      const result = new Function(`return ${sanitized}`)();
      
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('Error');
      } else {
        setDisplay(Number(result.toFixed(4)).toString());
      }
      setEquation('');
    } catch (e) {
      setDisplay('Error');
      setEquation('');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', margin: '8px 0', backgroundColor: 'var(--bg-primary)' }}>
      {/* Header Toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-tertiary)',
          borderBottom: isOpen ? '1px solid var(--border-color)' : 'none',
          userSelect: 'none'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalcIcon size={12} style={{ color: 'var(--accent)' }} /> Quick Calculator
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{isOpen ? '[-]' : '[+]'}</span>
      </div>

      {/* Calculator Body */}
      {isOpen && (
        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Screen */}
          <div style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', minHeight: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
              {equation || '\u00A0'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px', wordBreak: 'break-all' }}>
              {display}
            </div>
          </div>

          {/* Copy Bar */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            style={{ width: '100%', padding: '4px', fontSize: '10px', textTransform: 'uppercase', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            {copied ? (
              <>
                <Check size={10} style={{ color: 'var(--success)' }} /> Copied to Clipboard
              </>
            ) : (
              <>
                <Copy size={10} /> Copy Value
              </>
            )}
          </button>

          {/* Buttons Grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '4px',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px' }} onClick={handleClear}>C</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px' }} onClick={handleBackspace}>←</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px' }} onClick={() => handleOperator('/')}>/</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px' }} onClick={() => handleOperator('*')}>*</button>

            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('7')}>7</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('8')}>8</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('9')}>9</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px' }} onClick={() => handleOperator('-')}>-</button>

            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('4')}>4</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('5')}>5</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('6')}>6</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px' }} onClick={() => handleOperator('+')}>+</button>

            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('1')}>1</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('2')}>2</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={() => handleNum('3')}>3</button>
            <button 
              className="btn btn-primary btn-sm" 
              style={{ gridRow: 'span 2', padding: '0', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
              onClick={handleEqual}
            >
              =
            </button>

            <button 
              className="btn btn-secondary btn-sm" 
              style={{ gridColumn: 'span 2', padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} 
              onClick={() => handleNum('0')}
            >
              0
            </button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 0', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)' }} onClick={handleDecimal}>.</button>
          </div>

        </div>
      )}
    </div>
  );
}
