import { useEffect, useMemo, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import {
    calculateDistribution,
    DEFAULT_TICK_SAMPLE,
    DistributionTick,
} from './distribution-engine';
import { DistributionFeedState, subscribeDistributionFeed } from './distribution-feed';

type ActiveSymbol = {
    symbol: string;
    display_name?: string;
    market?: string;
    [key: string]: unknown;
};

export const useLiveDistribution = (symbol: string, barrier: number, sampleSize = DEFAULT_TICK_SAMPLE) => {
    // Re-render when the shared Deriv connection/authentication state changes; api_base is a mutable service.
    useApiBase();
    const [state, setState] = useState<DistributionFeedState>({
        ticks: [],
        loading: false,
        error: '',
    });

    useEffect(() => {
        if (!symbol) {
            setState({ ticks: [], loading: false, error: '' });
            return;
        }
        return subscribeDistributionFeed(symbol, sampleSize, setState);
    }, [symbol, sampleSize]);

    const activeSymbols = (api_base.active_symbols || []) as ActiveSymbol[];
    const symbolDetails = useMemo(
        () => activeSymbols.find(item => item.symbol === symbol),
        [activeSymbols, symbol]
    );
    const pipSize = (api_base.pip_sizes as Record<string, number> | undefined)?.[symbol];
    const snapshot = useMemo(
        () => calculateDistribution(state.ticks as DistributionTick[], barrier, pipSize, sampleSize),
        [state.ticks, barrier, pipSize, sampleSize]
    );

    return { ...state, snapshot, symbolDetails, activeSymbols };
};
