import 'package:flutter/foundation.dart';

class Env {
  // Central API Configuration base URL (adapts dynamically for Web vs Mobile Emulators)
  static const String apiBaseUrl = kIsWeb ? 'http://localhost:5000/api' : 'http://10.0.2.2:5000/api';
  
  // Dynamic Recipient UPI
  static const String merchantUpiId = '92lr@slc';
}
