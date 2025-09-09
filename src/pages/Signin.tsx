// src/pages/Signin.tsx
import AuthForm from './AuthForm';

export default function Signin() {
  return(
    <div className='justify-center items-center flex h-screen'>
       <AuthForm mode="signin" />
    </div>
  );
}