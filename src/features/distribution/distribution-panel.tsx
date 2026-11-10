import { useEffect, useMemo, useState } from 'react';
import { useLiveDistribution } from './use-live-distribution';
import './distribution-panel.scss';

type DistributionPanelProps = {
    compact?: boolean;
};

const DistributionPanel = ({ compact = false }: DistributionPanelProps) => {
    const [market, setMarket] = useState('all');
    const [symbol, setSymbol] = useState('');
    const [barrier, setBarrier] = useState(5);
    const { activeSymbols, snapshot, loading, error, symbolDetails } = useLiveDistribution(symbol, barrier);

    const markets = useMemo(
        () => Array.from(new Set(activeSymbols.map(item => item.market).filter(Boolean))) as string[],
        [activeSymbols]
    );
    const marketSymbols = useMemo(
        () => activeSymbols.filter(item => market === 'all' || item.market === market),
        [activeSymbols, market]
    );

    const selectedSymbol = marketSymbols.some(item => item.symbol === symbol)
        ? symbol
        : marketSymbols[0]?.symbol || '';

    useEffect(() => {
        if (selectedSymbol !== symbol) setSymbol(selectedSymbol);
    }, [selectedSymbol, symbol]);

    return (
        <section className={compact ? 'distribution distribution--compact' : 'distribution'}>
            <header className='distribution__header'>
                <div>
                    <p className='distribution__eyebrow'>NatoFX analytics</p>
                    <h2>{compact ? 'Live distribution' : 'Percentage distribution'}</h2>
                    <p className='distribution__subheading'>Last 500 ticks · Live Deriv feed</p>
                </div>
                <span className={loading ? 'distribution__status distribution__status--loading' : 'distribution__status'}>
                    {loading ? 'Loading' : error ? 'Feed issue' : snapshot.sampleSize > 0 ? 'Live' : 'Waiting for ticks'}
                </span>
            </header>

            <div className='distribution__controls'>
                <label>
                    <span>Market</span>
                    <select value={market} onChange={event => setMarket(event.target.value)}>
                        <option value='all'>All markets</option>
                        {markets.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                </label>
                <label>
                    <span>Symbol</span>
                    <select value={selectedSymbol} onChange={event => setSymbol(event.target.value)}>
                        {marketSymbols.map(item => (
                            <option key={item.symbol} value={item.symbol}>
                                {item.display_name || item.symbol}
                            </option>
                        ))}
                    </select>
                </label>
                <label className='distribution__barrier'>
                    <span>Custom barrier</span>
                    <input
                        type='number'
                        min={0}
                        max={9}
                        step={1}
                        value={barrier}
                        onChange={event => setBarrier(Math.max(0, Math.min(9, Number(event.target.value))))}
                    />
                </label>
            </div>

            {error && <p className='distribution__error'>{error}</p>}
            {!error && (
                <>
                    <div className='distribution__summary'>
                        <div>
                            <span>Ticks collected</span>
                            <strong>{snapshot.sampleSize}/500</strong>
                        </div>
                        <div>
                            <span>Calculation</span>
                            <strong>Last digit</strong>
                        </div>
                        <div>
                            <span>Selected market</span>
                            <strong>{symbolDetails?.market?.replaceAll('_', ' ') || '—'}</strong>
                        </div>
                    </div>

                    <div className='distribution__digits'>
                        {snapshot.digits.map(item => (
                            <div className='distribution__digit' key={item.digit}>
                                <div className='distribution__digit-top'>
                                    <strong>{item.digit}</strong>
                                    <span>{item.percentage.toFixed(1)}%</span>
                                </div>
                                <div className='distribution__track'>
                                    <span style={{ width: `${item.percentage}%` }} />
                                </div>
                                <small>{item.count} ticks</small>
                            </div>
                        ))}
                    </div>

                    <div className='distribution__over-under'>
                        <div className='distribution__metric'>
                            <span>Over {barrier}</span>
                            <strong>{snapshot.overPercentage.toFixed(1)}%</strong>
                            <small>{snapshot.overCount} ticks</small>
                        </div>
                        <div className='distribution__metric'>
                            <span>Under {barrier}</span>
                            <strong>{snapshot.underPercentage.toFixed(1)}%</strong>
                            <small>{snapshot.underCount} ticks</small>
                        </div>
                        <div className='distribution__metric distribution__metric--neutral'>
                            <span>Equal {barrier}</span>
                            <strong>{snapshot.equalPercentage.toFixed(1)}%</strong>
                            <small>{snapshot.equalCount} ticks excluded from Over/Under</small>
                        </div>
                    </div>
                    <p className='distribution__footnote'>
                        Over counts digits greater than the barrier; Under counts digits lower than it. Equal digits are reported separately.
                    </p>
                </>
            )}
        </section>
    );
};

export default DistributionPanel;
