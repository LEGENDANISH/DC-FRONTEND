// src/pages/AuthForm.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiService from '@/services/api'; // Import the centralized apiService
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert"; // For displaying errors

interface AuthFormProps {
  mode: 'signin' | 'signup';
}

// Define types for API responses and errors based on your backend
interface UserData {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatar?: string | null;
  // ... other user fields
}

interface AuthResponse {
  user: UserData;
  token: string;
}

interface ApiError {
  error?: string | { message: string }[]; // Backend can return string or array of Zod issues
  message?: string; // Sometimes a generic message field is used
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // For signup
  const [displayName, setDisplayName] = useState(''); // For signup (optional)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // State for displaying errors
  const navigate = useNavigate();

  const isSignin = mode === 'signin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null); // Clear any previous errors

    try {
      let response;
      if (isSignin) {
        // --- Login ---
        response = await apiService.post<AuthResponse>('/auth/login', {
          email,
          password,
        });
        console.log('Login successful:', response.data);
        // Store the JWT token received from the backend
        localStorage.setItem('token', response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user)); 
        console.log("Stored user:", response.data.user);

        // Redirect to the main application
        navigate('/discord');
      } else {
        // --- Signup ---
        // Prepare the payload, only including displayName if it's provided
        const signupPayload: any = { username, email, password };
        if (displayName.trim() !== '') {
          signupPayload.displayName = displayName.trim();
        }
        response = await apiService.post<AuthResponse>('/auth/register', signupPayload);
        console.log('Signup successful:', response.data);
        // Optionally, you could auto-login the user here, but typically redirect to login
        // Redirect to the login page so the user can log in with their new account
        navigate('/signin');
      }
    } catch (err: any) {
      console.error(`${isSignin ? 'Login' : 'Signup'} error:`, err);
      let errorMessage = `An error occurred during ${isSignin ? 'login' : 'signup'}. Please try again.`;

      // Attempt to extract a user-friendly error message from the response
      if (err.response?.data) {
        const apiError: ApiError = err.response.data;
        if (apiError.error) {
          if (typeof apiError.error === 'string') {
            errorMessage = apiError.error;
          } else if (Array.isArray(apiError.error)) {
            // Handle Zod validation errors (array of { message: ... })
            errorMessage = apiError.error.map(e => e.message).join(', ');
          }
        } else if (apiError.message) {
          // Fallback to a potential 'message' field
          errorMessage = apiError.message;
        }
      }

      setError(errorMessage); // Display the error message in the UI
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-svh bg-background"> {/* Ensure background matches theme */}
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-foreground">{isSignin ? 'Login to your account' : 'Create an account'}</CardTitle>
            <CardDescription>
              {isSignin
                ? 'Enter your email below to login to your account'
                : 'Enter your details below to create your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Display error message if present */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                {!isSignin && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="username" className="text-foreground">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="johndoe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required={!isSignin} // Required for signup
                        disabled={isLoading}
                        className="text-foreground"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="display-name" className="text-foreground">Display Name (Optional)</Label>
                      <Input
                        id="display-name"
                        type="text"
                        placeholder="John Doe"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={isLoading}
                        className="text-foreground"
                      />
                    </div>
                  </>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="text-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete={isSignin ? "current-password" : "new-password"}
                    className="text-foreground"
                  />
                </div>
              </div>
              <CardFooter className="flex-col gap-2 px-0 pb-0 pt-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? (isSignin ? "Signing in..." : "Creating account...")
                    : (isSignin ? "Login" : "Sign Up")}
                </Button>
                <div className="text-sm text-muted-foreground pt-2"> {/* Use theme-aware text color */}
                  {isSignin ? "Don't have an account? " : "Already have an account? "}
                  <Button variant="link" className="p-0 h-auto font-normal text-primary"> {/* Use theme-aware link color */}
                    <Link to={isSignin ? "/signup" : "/signin"}>
                      {isSignin ? "Sign Up" : "Sign In"}
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}