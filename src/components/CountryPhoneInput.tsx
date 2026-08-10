import React, { useState, useEffect, useRef } from 'react';
import { CountryConfig, Language } from '../types';
import { COUNTRIES, getBrowserCountry, formatE164 } from '../data/countries';
import { Search, ChevronDown, Check } from 'lucide-react';
import { translations } from '../i18n/translations';

interface Props {
  language: Language;
  value: string; // E.164 string or raw number
  onChange: (e164Value: string, localValue: string, country: CountryConfig) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export const CountryPhoneInput: React.FC<Props> = ({
  language,
  value,
  onChange,
  placeholder,
  autoFocus = false,
  required = false,
}) => {
  const t = translations[language];
  const [selectedCountry, setSelectedCountry] = useState<CountryConfig>(() => getBrowserCountry());
  const [localNumber, setLocalNumber] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract initial local number if E.164 is passed in value
  useEffect(() => {
    if (value) {
      const matchCountry = COUNTRIES.find((c) => value.startsWith(c.callingCode));
      if (matchCountry) {
        setSelectedCountry(matchCountry);
        setLocalNumber(value.replace(matchCountry.callingCode, ''));
      } else {
        setLocalNumber(value);
      }
    }
  }, []);

  // Handle Outside Click to Close Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCountrySelect = (c: CountryConfig) => {
    setSelectedCountry(c);
    localStorage.setItem('smart_khata_last_country', c.code);
    setIsOpen(false);
    setSearchQuery('');

    const e164 = formatE164(c.callingCode, localNumber);
    onChange(e164, localNumber, c);
  };

  const handleNumberChange = (val: string) => {
    setLocalNumber(val);
    const e164 = formatE164(selectedCountry.callingCode, val);
    onChange(e164, val, selectedCountry);
  };

  const filteredCountries = COUNTRIES.filter((c) => {
    const name = c.name[language] || c.name.en;
    const code = c.callingCode;
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || code.includes(q) || c.code.toLowerCase().includes(q);
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center rounded-2xl border-2 border-gray-300 dark:border-slate-600 focus-within:border-blue-600 bg-white dark:bg-slate-800 transition-all overflow-hidden shadow-sm">
        {/* Country Picker Trigger Button: [CountryCode] [FlagImg] [DialCode] */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-3 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 border-r-2 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white font-extrabold text-xs sm:text-sm transition-colors shrink-0 select-none z-10"
        >
          {/* Country Short Code (e.g. IN, BD) */}
          <span className="font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {selectedCountry.code}
          </span>

          {/* Graphical Flag Image (e.g. 🇮🇳, 🇧🇩) */}
          <img
            src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
            alt={selectedCountry.name.en}
            className="w-5 h-3.5 object-cover rounded border border-slate-300 dark:border-slate-600 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Calling Code Badge (e.g. +91, +880) */}
          <span className="bg-slate-200 dark:bg-slate-600 text-gray-900 dark:text-white text-xs font-black px-1.5 py-0.5 rounded tracking-tight">
            {selectedCountry.callingCode}
          </span>

          {/* Dropdown Caret */}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </button>

        {/* Local Number Input */}
        <input
          type="tel"
          required={required}
          value={localNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder || t.mobile_placeholder}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 px-3.5 py-3 text-xl font-black tracking-wide text-gray-900 dark:text-white bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-400"
        />
      </div>

      {/* Country Selection Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-gray-300 dark:border-slate-600 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_country}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 rounded-xl border border-gray-300 dark:border-slate-600 text-xs font-bold outline-none focus:border-blue-600"
                autoFocus
              />
            </div>
          </div>

          {/* Country List: [CountryCode] [FlagImg] [DialCode] */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredCountries.map((c) => {
              const isSelected = selectedCountry.code === c.code;
              const countryName = c.name[language] || c.name.en;

              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-gray-900 dark:text-white font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    {/* [CountryCode] [FlagImg] [DialCode] */}
                    <span className="font-black text-xs uppercase px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded">
                      {c.code}
                    </span>
                    <img
                      src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                      alt={countryName}
                      className="w-5 h-3.5 object-cover rounded border border-slate-300 dark:border-slate-600 shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400">
                      {c.callingCode}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[130px] sm:max-w-[170px]">
                      • {countryName}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                </button>
              );
            })}

            {filteredCountries.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                No country matches "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
