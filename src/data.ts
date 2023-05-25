async function getInitialState(projectID: string, userID: string): Promise<void> {
    const endpoint =
        'https://om97mq7cx4.execute-api.ap-northeast-2.amazonaws.com/default/notifly-js-sdk-user-state-retrieval';
    const queryParams = {
        projectID: projectID,
        userID: userID,
    };

    const url = new URL(endpoint);
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
        searchParams.append(key, value);
    });
    url.search = searchParams.toString();

    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        console.log('Response:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

export { getInitialState };
