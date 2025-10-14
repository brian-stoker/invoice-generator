# Contributing to Invoice Generator

Thank you for your interest in contributing! This project welcomes contributions from everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node version, etc.)
- Relevant logs or error messages

### Suggesting Features

We love new ideas! Please open an issue with:
- Clear description of the feature
- Use case: why would this be useful?
- Proposed implementation (if you have one)
- Examples of similar features in other tools

### Submitting Pull Requests

1. **Fork the repository** and create a branch from `main`
2. **Make your changes**:
   - Write clear, readable code
   - Add comments where helpful
   - Follow existing code style
3. **Test your changes**:
   ```bash
   npm run build
   invoice-gen xferall-biweekly --verbose
   ```
4. **Commit your changes**:
   - Use clear commit messages
   - Format: `feat: add new feature` or `fix: resolve bug`
5. **Push to your fork** and **submit a PR**
6. **Wait for review** - we'll review and provide feedback

### PR Requirements

- **1 approval required** before merging
- Keep PRs focused (one feature/fix per PR)
- Include tests if adding new functionality
- Update documentation if needed
- Ensure build passes (`npm run build`)

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/invoice-generator.git
cd invoice-generator

# Install dependencies
npm install

# Set up environment
cp .env.template .env
# Edit .env with your Gmail credentials

# Build
npm run build

# Test
invoice-gen --list
```

## Code Style

- Use TypeScript
- Use meaningful variable names
- Add JSDoc comments for public functions
- Keep functions focused and small
- Follow existing patterns in the codebase

## Project Structure

```
invoice-generator/
├── src/
│   ├── types/         # TypeScript type definitions
│   ├── cli.ts         # Command-line interface
│   ├── scheduler.ts   # Automated scheduler
│   ├── config-loader.ts   # Configuration management
│   ├── invoice-generator.ts   # Core invoice logic
│   └── email-sender.ts    # Email functionality
├── invoice-configs.json   # Invoice configurations
└── README.md
```

## Areas We'd Love Help With

- 🎨 UI/UX improvements for CLI output
- 📊 Additional commit categorization patterns
- 🔧 More schedule types (custom cron support)
- 🌍 Internationalization
- 📝 Documentation improvements
- 🧪 Test coverage
- 🐛 Bug fixes
- ⚡ Performance optimizations

## Questions?

- Open an issue for questions
- Tag with `question` label
- We'll respond as soon as possible!

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something useful together.

## Credits

This project was created by:
- **Product Manager**: Brian Stoker
- **Developer**: Claude (Anthropic AI Assistant)

All contributors are recognized in our commit history and release notes.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
