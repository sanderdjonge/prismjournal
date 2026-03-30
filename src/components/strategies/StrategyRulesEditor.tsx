'use client';

import { useState, useEffect } from 'react';
import { StrategyRuleType } from '@prisma/client';

interface Rule {
  id: string;
  type: StrategyRuleType;
  enabled: boolean;
  [key: string]: any;
}

interface RulesConfig {
  version: number;
  rules: Rule[];
}

interface Props {
  strategyId: string;
  onSave?: () => void;
}

const RULE_TYPES: { type: StrategyRuleType; label: string; description: string }[] = [
  { type: 'MAX_DAILY_LOSS', label: 'Max Daily Loss', description: 'Limit daily loss amount or percentage' },
  { type: 'MAX_DAILY_TRADES', label: 'Max Daily Trades', description: 'Limit number of trades per day' },
  { type: 'MIN_RR_RATIO', label: 'Min R:R Ratio', description: 'Require minimum risk/reward ratio' },
  { type: 'MANDATORY_STOP_LOSS', label: 'Mandatory Stop Loss', description: 'Require stop loss on every trade' },
  { type: 'MAX_POSITION_SIZE', label: 'Max Position Size', description: 'Limit lot/contract size' },
  { type: 'NO_OVERTRADING', label: 'No Overtrading', description: 'Limit trades per hour' },
  { type: 'ALLOWED_TIME_WINDOWS', label: 'Allowed Hours', description: 'Only trade during specific hours' },
  { type: 'ALLOWED_SYMBOLS', label: 'Allowed Symbols', description: 'Restrict trading to specific instruments' },
  { type: 'MAX_HOLDING_TIME', label: 'Max Holding Time', description: 'Maximum time to hold a position' },
  { type: 'MIN_HOLDING_TIME', label: 'Min Holding Time', description: 'Minimum time before closing' },
];

export default function StrategyRulesEditor({ strategyId, onSave }: Props) {
  const [config, setConfig] = useState<RulesConfig>({ version: 1, rules: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, [strategyId]);

  async function fetchRules() {
    try {
      const res = await fetch(`/api/strategies/${strategyId}/rules`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data.rules || { version: 1, rules: [] });
      }
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveRules() {
    setSaving(true);
    try {
      const res = await fetch(`/api/strategies/${strategyId}/rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        onSave?.();
      }
    } catch (err) {
      console.error('Failed to save rules:', err);
    } finally {
      setSaving(false);
    }
  }

  function addRule(type: StrategyRuleType) {
    const newRule = createDefaultRule(type);
    setConfig(prev => ({
      ...prev,
      rules: [...prev.rules, newRule],
    }));
    setExpandedRule(newRule.id);
  }

  function removeRule(ruleId: string) {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId),
    }));
  }

  function updateRule(ruleId: string, updates: Partial<Rule>) {
    setConfig(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r),
    }));
  }

  if (loading) {
    return <div className="animate-pulse p-4">Loading rules...</div>;
  }

  const existingTypes = config.rules.map(r => r.type);
  const availableTypes = RULE_TYPES.filter(t => !existingTypes.includes(t.type));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">Strategy Rules</h3>
        <button
          onClick={saveRules}
          disabled={saving}
          className="px-4 py-2 bg-primary hover:bg-primary/80 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>

      {/* Existing Rules */}
      {config.rules.length > 0 && (
        <div className="space-y-2">
          {config.rules.map(rule => (
            <div key={rule.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateRule(rule.id, { enabled: e.target.checked });
                    }}
                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                  />
                  <span className="font-medium text-white">{RULE_TYPES.find(t => t.type === rule.type)?.label}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRule(rule.id);
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wide transition-colors"
                >
                  Remove
                </button>
              </div>
              
              {expandedRule === rule.id && (
                <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                  <RuleConfigEditor rule={rule} onChange={(updates) => updateRule(rule.id, updates)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Rule Dropdown */}
      {availableTypes.length > 0 && (
        <div className="border border-dashed border-white/20 rounded-xl p-4 bg-white/[0.02]">
          <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Add a rule</label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addRule(e.target.value as StrategyRuleType);
                e.target.value = '';
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary/50 focus:outline-none transition-colors"
            value=""
          >
            <option value="" className="bg-gray-900">Select a rule type...</option>
            {availableTypes.map(t => (
              <option key={t.type} value={t.type} className="bg-gray-900">
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {config.rules.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-8">
          No rules configured. Add rules to track strategy compliance.
        </p>
      )}
    </div>
  );
}

function createDefaultRule(type: StrategyRuleType): Rule {
  const id = `rule-${Date.now()}`;
  const base = { id, type, enabled: true };
  
  switch (type) {
    case 'MAX_DAILY_LOSS':
      return { ...base, limit: 500, isPercentage: false };
    case 'MAX_DAILY_TRADES':
      return { ...base, limit: 5 };
    case 'MIN_RR_RATIO':
      return { ...base, limit: 1.5 };
    case 'MAX_POSITION_SIZE':
      return { ...base, limit: 1.0 };
    case 'NO_OVERTRADING':
      return { ...base, maxTradesPerHour: 3 };
    case 'MANDATORY_STOP_LOSS':
      return base;
    case 'ALLOWED_TIME_WINDOWS':
      return { ...base, windows: [], timezone: 'UTC' };
    case 'ALLOWED_SYMBOLS':
      return { ...base, symbols: [], mode: 'ALLOW' };
    case 'MAX_HOLDING_TIME':
      return { ...base, maxMinutes: 60 };
    case 'MIN_HOLDING_TIME':
      return { ...base, minMinutes: 5 };
    default:
      return base;
  }
}

function RuleConfigEditor({ rule, onChange }: { rule: Rule; onChange: (updates: Partial<Rule>) => void }) {
  switch (rule.type) {
    case 'MAX_DAILY_LOSS':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Limit</label>
            <input
              type="number"
              value={rule.limit}
              onChange={(e) => onChange({ limit: parseFloat(e.target.value) })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            />
            <select
              value={rule.isPercentage ? 'percent' : 'amount'}
              onChange={(e) => onChange({ isPercentage: e.target.value === 'percent' })}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary/50 focus:outline-none"
            >
              <option value="amount" className="bg-gray-900">$ (amount)</option>
              <option value="percent" className="bg-gray-900">% (percentage)</option>
            </select>
          </div>
        </div>
      );
    
    case 'MAX_DAILY_TRADES':
      return (
        <div className="flex items-center gap-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Max Trades</label>
          <input
            type="number"
            value={rule.limit}
            onChange={(e) => onChange({ limit: parseInt(e.target.value) })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            min="1"
          />
        </div>
      );
    
    case 'MIN_RR_RATIO':
      return (
        <div className="flex items-center gap-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Min R:R</label>
          <input
            type="number"
            value={rule.limit}
            onChange={(e) => onChange({ limit: parseFloat(e.target.value) })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            step="0.1"
            min="0"
          />
        </div>
      );
    
    case 'MAX_POSITION_SIZE':
      return (
        <div className="flex items-center gap-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Max Lots</label>
          <input
            type="number"
            value={rule.limit}
            onChange={(e) => onChange({ limit: parseFloat(e.target.value) })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            step="0.1"
            min="0"
          />
        </div>
      );
    
    case 'NO_OVERTRADING':
      return (
        <div className="flex items-center gap-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Max/Hour</label>
          <input
            type="number"
            value={rule.maxTradesPerHour}
            onChange={(e) => onChange({ maxTradesPerHour: parseInt(e.target.value) })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            min="1"
          />
        </div>
      );
    
    case 'MAX_HOLDING_TIME':
      return (
        <div className="flex items-center gap-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Max Minutes</label>
          <input
            type="number"
            value={rule.maxMinutes}
            onChange={(e) => onChange({ maxMinutes: parseInt(e.target.value) })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            min="1"
          />
        </div>
      );
    
    case 'MIN_HOLDING_TIME':
      return (
        <div className="flex items-center gap-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-500 w-24">Min Minutes</label>
          <input
            type="number"
            value={rule.minMinutes}
            onChange={(e) => onChange({ minMinutes: parseInt(e.target.value) })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-32 text-white focus:border-primary/50 focus:outline-none"
            min="1"
          />
        </div>
      );
    
    default:
      return <p className="text-sm text-gray-500">No additional configuration needed.</p>;
  }
}
