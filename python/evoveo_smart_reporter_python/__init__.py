"""
Evoveo Smart Reporter - Python Bridge

Python/pytest integration for the Evoveo Smart Reporter.
Converts pytest results to Evoveo Smart Reporter format and generates
HTML reports with AI-powered analysis.

Requires Node.js 18+ at runtime (no npm install needed).
"""

from .bridge import SmartReporterBridge

__version__ = "1.0.8"
__all__ = ["SmartReporterBridge"]
