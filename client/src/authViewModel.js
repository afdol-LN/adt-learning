import { authenRequest, registerApi } from "./authApi";
import { hash } from "./hash";

export async function login(loginForm) {
    console.log("Login");
    console.log(loginForm);

    try {

        const requestHash = hash(
            loginForm.username + "&" + Date.now()
        );

        console.log("Request Hash:", requestHash);

        const result = await authenRequest({
            username: loginForm.username,
            request_hash: requestHash,
        });

        console.log("authenRequest Result:", result);

    } catch (error) {
        console.error(error);
    }
}

export async function register(regForm) {
    console.log("Register");
    console.log(regForm);

    try {
        const result = await registerApi({
            username: regForm.username,
            password: regForm.password,
        });

        console.log("Register Result:", result);

    } catch (error) {
        console.error(error);
    }
}