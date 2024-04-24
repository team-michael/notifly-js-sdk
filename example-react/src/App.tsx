import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, Outlet } from 'react-router-dom';

import notifly from 'notifly-js-sdk';
import logo from './logo.svg';
import './App.css';
import Playground from './Playground';
import localforage from 'localforage';

const USER_ID = 'javascript-sdk-react-test';

const storage = localforage.createInstance({
    driver: localforage.INDEXEDDB, // This should be forced to IndexedDB because service worker is using IndexedDB
    name: 'notifly',
    storeName: 'notiflyconfig',
    version: 1.0,
});

function App() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // notifly.setUserId(USER_ID).then(() => {
            //     console.log('User ID set');
            //     console.log(Date.now());
            // });

            // notifly
            //     .setUserProperties({
            //         test_property: 'test_value',
            //     })
            //     .then(() => {
            //         console.log('User property set');
            //         console.log(Date.now());
            //     });

            notifly
                .initialize({
                    projectId: process.env.REACT_APP_NOTIFLY_PROJECT_ID!,
                    username: process.env.REACT_APP_NOTIFLY_USERNAME!,
                    password: process.env.REACT_APP_NOTIFLY_PASSWORD!,
                })
                .then(() => {
                    console.log('Notifly SDK initialized');
                });

            notifly.trackEvent('sdk_initialized').then(() => {
                console.log('SDK initialized event tracked');
                console.log(Date.now());
            });
        }
    }, []);

    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="playground" element={<Playground />} />
            </Routes>
        </div>
    );
}

function HomePage() {
    return (
        <div className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <p className="App-link" rel="noopener noreferrer">
                Notifly js SDK example react app
            </p>
            <UserIdSetter />
            <IndexedDBDumper />
            <UserPropertySetter />
            <TrackEventSection />
            <RemoveUserIdButton />
            <Link to="/playground">Go to playground</Link>
            <Outlet />
        </div>
    );
}

function IndexedDBDumper() {
    const [keyName, setKeyName] = useState('');
    const [value, setValue] = useState('');

    const handleDump = async () => {
        const value = await storage.getItem(keyName);
        let displayValue = value;
        try {
            displayValue = JSON.stringify(JSON.parse(value as string), null, 2);
        } catch (e) {}
        setValue(displayValue as string);
    };

    return (
        <div>
            <input type="text" placeholder="Key" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <button onClick={handleDump}>Dump</button>
            <pre
                style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    fontSize: '12px',
                    maxWidth: '500px',
                    textAlign: 'left',
                }}
            >
                {value}
            </pre>
        </div>
    );
}

function TrackEventSection() {
    const eventParamsRef = useRef<HTMLTextAreaElement>(null);
    const [eventName, setEventName] = useState('');

    return (
        <div style={{ margin: '10px' }}>
            <input
                type="text"
                placeholder="Event Name"
                onChange={(e) => {
                    setEventName(e.target.value);
                }}
                value={eventName}
            />
            <textarea ref={eventParamsRef} placeholder="Event Params (JSON)" />
            <button
                onClick={() => {
                    let eventParams = {};
                    if (eventParamsRef.current && eventParamsRef.current.value) {
                        try {
                            eventParams = JSON.parse(eventParamsRef.current.value);
                        } catch (e) {
                            alert('Invalid JSON');
                            console.error(e);
                        }
                    }
                    notifly.trackEvent(eventName, eventParams).then(() => {
                        console.log(
                            `Event ${eventName} tracked successfully with params ${JSON.stringify(eventParams)}`
                        );
                    });
                }}
            >
                Track Event
            </button>
        </div>
    );
}

function UserIdSetter() {
    const [userIdInput, setUserIdInput] = useState('');

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUserIdInput(event.target.value);
    };

    const handleSetUserId = () => {
        notifly.setUserId(userIdInput);
        console.log(`Set user id to ${userIdInput}`);
    };

    return (
        <div style={{ margin: '10px' }}>
            <input
                type="text"
                name="setUserId"
                value={userIdInput}
                onChange={handleInputChange}
                placeholder="user id"
            />
            <button onClick={handleSetUserId}>Set User Id</button>
        </div>
    );
}

function UserPropertySetter() {
    const keyRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState<string | string[] | number | boolean>('');

    const valueTypeOptions = [
        { value: 'TEXT', label: 'Text' },
        { value: 'INT', label: 'Integer' },
        { value: 'BOOL', label: 'Boolean' },
        { value: 'ARRAY', label: 'Array' },
    ];
    const [valueType, setValueType] = useState(valueTypeOptions[0].value);

    useEffect(() => {
        if (valueType === 'TEXT') {
            setValue('');
        } else if (valueType === 'INT') {
            setValue(0);
        } else if (valueType === 'BOOL') {
            setValue(true);
        } else if (valueType === 'ARRAY') {
            setValue([]);
        }
    }, [valueType]);

    return (
        <div>
            <div style={{ margin: '10px' }}>
                <input type="text" name="setUserId" ref={keyRef} placeholder="key" />
                {valueType === 'TEXT' ? (
                    <input
                        type="text"
                        name="setUserId"
                        placeholder="value"
                        onChange={(e) => {
                            setValue(e.target.value);
                        }}
                        value={value.toString()}
                    />
                ) : valueType === 'INT' ? (
                    <input
                        type="number"
                        name="setUserId"
                        placeholder="value"
                        onChange={(e) => {
                            const parsedValue = parseInt(e.target.value);
                            if (isNaN(parsedValue)) {
                                setValue(0);
                            } else {
                                setValue(parsedValue);
                            }
                        }}
                        value={value.toString()}
                    />
                ) : valueType === 'BOOL' ? (
                    <select
                        onChange={(e) => {
                            setValue(e.target.value === 'true');
                        }}
                        value={value ? 'true' : 'false'}
                    >
                        <option value="true">true</option>
                        <option value="false">false</option>
                    </select>
                ) : (
                    <input
                        type="text"
                        placeholder="value"
                        onChange={(e) => {
                            setValue(e.target.value.split(',').map((v) => v.trim()));
                        }}
                        value={Array.isArray(value) ? value.join(', ') : value.toString()}
                    />
                )}
                <select onChange={(e) => setValueType(e.target.value)}>
                    {valueTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <button
                    onClick={() => {
                        if (keyRef.current) {
                            notifly.setUserProperties({
                                [keyRef.current.value]: value,
                            });
                        }
                    }}
                >
                    Set User Property
                </button>
            </div>
            {valueType === 'ARRAY' && (
                <p
                    style={{
                        fontSize: '12px',
                        color: '#999',
                    }}
                >
                    Please separate array values with commas
                </p>
            )}
        </div>
    );
}

function RemoveUserIdButton() {
    const handleClick = () => {
        notifly.setUserId();
    };

    return (
        <div style={{ margin: '10px' }}>
            <button onClick={handleClick}>Remove User Id</button>
        </div>
    );
}

export default App;
