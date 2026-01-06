import { NextResponse } from 'next/server';

const unauthorized = () => {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Acceptatiebeheer"',
    },
  });
};

export function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  if (!user || !pass) {
    return unauthorized();
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Basic ')) {
    return unauthorized();
  }

  let decoded = '';
  try {
    decoded = atob(authHeader.replace('Basic ', ''));
  } catch (err) {
    return unauthorized();
  }

  const [inputUser, inputPass] = decoded.split(':');
  if (inputUser !== user || inputPass !== pass) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/(.*)'],
};
