import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../../config/env.dart';

enum AuthStatus { unauthenticated, authenticating, authenticated, error }

class AuthState {
  final AuthStatus status;
  final String? accessToken;
  final Map<String, dynamic>? userProfile;
  final String? errorMessage;

  AuthState({
    required this.status,
    this.accessToken,
    this.userProfile,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? accessToken,
    Map<String, dynamic>? userProfile,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      accessToken: accessToken ?? this.accessToken,
      userProfile: userProfile ?? this.userProfile,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}



class AuthNotifier extends StateNotifier<AuthState> {
  final _storage = const FlutterSecureStorage();
  final _dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

  AuthNotifier() : super(AuthState(status: AuthStatus.unauthenticated)) {
    _checkSavedToken();
  }

  Future<void> _checkSavedToken() async {
    final token = await _storage.read(key: 'accessToken');
    if (token != null) {
      state = state.copyWith(status: AuthStatus.authenticated, accessToken: token);
      await fetchProfile();
    }
  }

  Future<void> register(String email, String name, String password, {String? referral}) async {
    state = state.copyWith(status: AuthStatus.authenticating);
    try {
      final res = await _dio.post('/auth/register', data: {
        'email': email,
        'name': name,
        'password': password,
        'referralCode': referral,
      });

      final token = res.data['accessToken'] as String;
      await _storage.write(key: 'accessToken', value: token);

      state = AuthState(
        status: AuthStatus.authenticated,
        accessToken: token,
        userProfile: res.data['user'],
      );
    } on DioException catch (e) {
      final msg = e.response?.data['error'] ?? e.response?.data['message'] ?? 'Registration failed';
      state = AuthState(status: AuthStatus.error, errorMessage: msg);
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.authenticating);
    try {
      final res = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final token = res.data['accessToken'] as String;
      await _storage.write(key: 'accessToken', value: token);

      state = AuthState(
        status: AuthStatus.authenticated,
        accessToken: token,
        userProfile: res.data['user'],
      );
    } on DioException catch (e) {
      final msg = e.response?.data['error'] ?? e.response?.data['message'] ?? 'Invalid credentials';
      state = AuthState(status: AuthStatus.error, errorMessage: msg);
    }
  }

  Future<void> fetchProfile() async {
    if (state.accessToken == null) return;
    try {
      final res = await _dio.get(
        '/auth/me',
        options: Options(headers: {'Authorization': 'Bearer ${state.accessToken}'}),
      );
      state = state.copyWith(userProfile: res.data['user']);
    } catch (_) {
      logout();
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'accessToken');
    state = AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
