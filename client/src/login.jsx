import { useState } from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { login, register } from "./authViewModel";

export default function Login() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("login");

  // Login Form
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  // Register Form
  const [regForm, setRegForm] = useState({
    username: "",
    password: "",
    confirm: "",
  });

  // UI State
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    show: false,
    type: "success",
    message: "",
  });

  const showToast = (message, type = "success") => {
    setToast({
      show: true,
      message,
      type,
    });

    setTimeout(() => {
      setToast((prev) => ({
        ...prev,
        show: false,
      }));
    }, 3000);
  };

  // Login
  const handleLogin = async () => {

    if (!loginForm.username || !loginForm.password) {
        showToast("Please fill in all fields", "error");
        return;
    }

    await login(loginForm);

    setLoading(true);

    // TODO
    // OAuth Flow
    // request authen_token
    // authen_access

    setTimeout(() => {
      setLoading(false);

      showToast("Login Success");

      // ตัวอย่าง
      // navigate("/home");
    }, 1000);
  };

  // Register
  const handleRegister = async () => {

    if (
        !regForm.username ||
        !regForm.password ||
        !regForm.confirm
    ) {
        showToast("Please fill in all fields", "error");
        return;
    }

    if (regForm.password !== regForm.confirm) {
        showToast("Password not match", "error");
        return;
    }

    await register(regForm);

    setLoading(true);

    // TODO
    // Register API

    setTimeout(() => {
      setLoading(false);

      showToast("Register Success");

      setActiveTab("login");
    }, 1000);
  };

  return (
    <div className="container">

      <div className="background"></div>

      <div className="card">

        <div className="logo">
          <h1>ADT Learning</h1>
          <p>Adaptive Digital Training</p>
        </div>

        <div className="tabs">

          <button
            className={activeTab === "login" ? "active" : ""}
            onClick={() => setActiveTab("login")}
          >
            Login
          </button>

          <button
            className={activeTab === "register" ? "active" : ""}
            onClick={() => setActiveTab("register")}
          >
            Register
          </button>

        </div>

        {/* LOGIN */}

        {activeTab === "login" && (

          <div className="panel">

            <h2>Welcome Back</h2>

            <div className="field">

              <label>Username</label>

              <input
                type="text"
                placeholder="Username"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({
                    ...loginForm,
                    username: e.target.value,
                  })
                }
              />

            </div>

            <div className="field">

              <label>Password</label>

              <div className="password">

                <input
                  type={showLoginPw ? "text" : "password"}
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({
                      ...loginForm,
                      password: e.target.value,
                    })
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowLoginPw(!showLoginPw)
                  }
                >
                  {showLoginPw ? "🙈" : "👁"}
                </button>

              </div>

            </div>

            <button
              className="primaryBtn"
              onClick={handleLogin}
            >
              {loading ? "Loading..." : "Login"}
            </button>

            <div className="switch">

              Don't have an account?

              <span
                onClick={() => setActiveTab("register")}
              >
                Register
              </span>

            </div>

          </div>

        )}
                {/* REGISTER */}

        {activeTab === "register" && (

          <div className="panel">

            <h2>Create Account</h2>

            <div className="field">

              <label>Username</label>

              <input
                type="text"
                placeholder="Username"
                value={regForm.username}
                onChange={(e) =>
                  setRegForm({
                    ...regForm,
                    username: e.target.value,
                  })
                }
              />

            </div>

            <div className="field">

              <label>Password</label>

              <div className="password">

                <input
                  type={showRegPw ? "text" : "password"}
                  placeholder="Password"
                  value={regForm.password}
                  onChange={(e) =>
                    setRegForm({
                      ...regForm,
                      password: e.target.value,
                    })
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowRegPw(!showRegPw)
                  }
                >
                  {showRegPw ? "🙈" : "👁"}
                </button>

              </div>

            </div>

            <div className="field">

              <label>Confirm Password</label>

              <div className="password">

                <input
                  type={showConfirmPw ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={regForm.confirm}
                  onChange={(e) =>
                    setRegForm({
                      ...regForm,
                      confirm: e.target.value,
                    })
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPw(!showConfirmPw)
                  }
                >
                  {showConfirmPw ? "🙈" : "👁"}
                </button>

              </div>

            </div>

            <button
              className="primaryBtn"
              onClick={handleRegister}
            >
              {loading ? "Loading..." : "Register"}
            </button>

            <div className="switch">

              Already have an account?

              <span
                onClick={() => setActiveTab("login")}
              >
                Login
              </span>

            </div>

          </div>

        )}

      </div>

      {toast.show && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

    </div>
  );
}