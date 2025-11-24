import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
    const res = NextResponse.next({
        request: {
            headers: req.headers,
        },
    })
    const supabase = createMiddlewareClient({ req, res })

    // Refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-session-with-middleware
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    // console.log("Incoming cookies", req.cookies.getAll())
    // console.log("User:", user)
    // console.log("Error:", error)

    // If user is not signed in and the current path is /dashboard, redirect the user to /
    // if ((error || !user) && req.nextUrl.pathname.startsWith('/dashboard')) {
    //     return NextResponse.redirect(new URL('/', req.url))
    // }

    return res
}

export const config = {
    matcher: ['/dashboard/:path*'],
}
