import { Link } from 'react-router-dom';

const MyPage = () => {
    return (
        <div className="App-header">
            <h1>This is a My page</h1>
            <p>Welcome to the My Page!</p>
            <Link to="/">Go back to home</Link>
        </div>
    );
};

export default MyPage;
