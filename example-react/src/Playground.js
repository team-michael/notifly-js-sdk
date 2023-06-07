import React from 'react';
import { Link } from 'react-router-dom';

const Playground = () => {
    return (
        <div className="App-header">
            <h1>This is a Playground subpage.</h1>
            <p>Welcome to the Playground!</p>
            <Link to="/">Go back to home</Link>
        </div>
    );
}

export default Playground;
