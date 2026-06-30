import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/auth_provider.dart';

// Import Screens (to be created next)
import '../screens/home_screen.dart';
import '../screens/login_screen.dart';
import '../screens/signup_screen.dart';
import '../screens/tournament_detail_screen.dart';
import '../screens/wallet_screen.dart';
import '../screens/deposit_screen.dart';
import '../screens/withdraw_screen.dart';
import '../screens/referral_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/signup';
      
      if (authState.status == AuthStatus.authenticating) {
        return null;
      }
      
      if (authState.status == AuthStatus.unauthenticated) {
        return isLoggingIn ? null : '/login';
      }

      if (isLoggingIn) {
        return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignupScreen(),
      ),
      GoRoute(
        path: '/tournament/:id',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id']!;
          return CustomTransitionPage(
            key: state.pageKey,
            child: TournamentDetailScreen(tournamentId: id),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return SlideTransition(
                position: animation.drive(
                  Tween<Offset>(
                    begin: const Offset(1.0, 0.0),
                    end: Offset.zero,
                  ).chain(CurveTween(curve: Curves.easeInOutCubic)),
                ),
                child: child,
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/wallet',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const WalletScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: animation.drive(Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero).chain(CurveTween(curve: Curves.easeInOutCubic))),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/deposit',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const DepositScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: animation.drive(Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero).chain(CurveTween(curve: Curves.easeInOutCubic))),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/withdraw',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const WithdrawScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: animation.drive(Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero).chain(CurveTween(curve: Curves.easeInOutCubic))),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/referral',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const ReferralScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: animation.drive(Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero).chain(CurveTween(curve: Curves.easeInOutCubic))),
              child: child,
            );
          },
        ),
      ),
    ],
  );
});
