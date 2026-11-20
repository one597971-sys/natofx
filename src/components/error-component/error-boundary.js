import React from 'react';
import PropTypes from 'prop-types';
import ErrorComponent from './index';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    componentDidCatch = (error, info) => {
        // Preserve the recovery UI, but expose the original exception and React component stack
        // so runtime failures can be diagnosed from the browser console.
        console.error('[NATOFX] React ErrorBoundary caught an error:', error);
        if (info?.componentStack) {
            console.error('[NATOFX] React component stack:', info.componentStack);
        }
        if (window.TrackJS) window.TrackJS.console.log({ error, info, root_store: this.props.root_store });

        this.setState({
            hasError: true,
            error,
            info,
        });
    };
    render = () => (this.state.hasError ? <ErrorComponent should_show_refresh={true} /> : this.props.children);
}

ErrorBoundary.propTypes = {
    root_store: PropTypes.object,
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
};

export default ErrorBoundary;
