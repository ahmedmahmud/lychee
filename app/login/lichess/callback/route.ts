import { OAuth2RequestError } from 'arctic';
import { generateId } from 'lucia';
import { cookies } from 'next/headers';
import { lichess, lucia } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { LichessUser } from '@/types/lichess-api';
import { fetchLichessRating } from '@/src/rating/getRating';
import { RatingColl } from '@/models/RatingColl';
import { AllRoundColl } from '@/models/AllRoundColl';
import { InitRatingColl } from '@/models/InitRatingColl';

export async function GET(request: Request): Promise<Response> {
  await dbConnect();

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies().get('lichess_oauth_state')?.value ?? null;
  const codeVerifier = cookies().get('lichess_oauth_code_validation')?.value;

  if (
    !code ||
    !state ||
    !storedState ||
    state !== storedState ||
    !codeVerifier
  ) {
    return new Response(
      "code or state don't match stored to those stored in cookies",
      {
        status: 400,
      }
    );
  }

  try {
    const tokens = await lichess.validateAuthorizationCode(code, codeVerifier);
    const lichessUserResponse = await fetch('https://lichess.org/api/account', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    const lichessUser: LichessUser = await lichessUserResponse.json();

    cookies().set('token', tokens.accessToken, {
      sameSite: 'lax',
      secure: true,
    });

    const existingUser = await User.findOne({ username: lichessUser.id });

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/',
        },
      });
    }

    const userId = generateId(15);
    const user = await User.create({
      _id: userId,
      username: lichessUser.id,
    });

    // Initialise user rating.
    const userRating = await fetchLichessRating(user);
    await RatingColl.create({
      username: user.username,
      ...userRating,
    });
    await InitRatingColl.create({
      username: user.username,
      rating: userRating.rating,
    });

    // Initialise user rounds.
    // NB: This is important. If new user, set solved to be empty. The submit endpoint relies on this.
    await AllRoundColl.create({
      username: user.username,
      solved: [],
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    });
  } catch (e) {
    if (
      e instanceof OAuth2RequestError &&
      e.message === 'bad_verification_code'
    ) {
      return new Response(JSON.stringify(e), {
        status: 400,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}
