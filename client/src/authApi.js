const BASE_URL = "http://localhost:3000";

export async function authenRequest(data) {

    const response = await fetch(`${BASE_URL}/authen/authen_request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    return await response.json();
}

export async function authenAccess(data) {

    const response = await fetch(`${BASE_URL}/authen/authen_access`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    return await response.json();
}

export async function registerApi(data) {

    const response = await fetch(`${BASE_URL}/authen/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    return await response.json();
}