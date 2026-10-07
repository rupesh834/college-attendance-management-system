// Small wrapper around fetch(). Every call returns JSON or throws an Error with a readable message.
const api = {
    async request(method, url, body) {
        let response;
        try {
            response = await fetch(url, {
                method: method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined
            });
        } catch (e) {
            throw new Error('Cannot reach the server. Is "npm start" running?');
        }
        let data = null;
        try { data = await response.json(); } catch (e) { /* no body */ }
        if (!response.ok) throw new Error((data && data.error) || 'Request failed (' + response.status + ').');
        return data;
    },
    get(url) { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); },
    put(url, body) { return this.request('PUT', url, body); },
    del(url) { return this.request('DELETE', url); }
};
