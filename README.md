# MaiBroker Frontend

A modern trading platform frontend built with Next.js, featuring real-time order matching, WhatsApp integration, and a beautiful UI.

## Features

- 🔐 **Authentication**: Secure login and registration with JWT tokens
- 📊 **Real-time Dashboard**: Live market data, order management, and trade history
- 💬 **WhatsApp Integration**: Trade via natural language messages
- 🎨 **Modern UI**: Beautiful, responsive design with animations
- ⚡ **Fast Performance**: Built with Next.js 15 and React 19
- 🔄 **Real-time Updates**: Automatic data refresh and live updates

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: Tailwind CSS with custom components
- **Animations**: Framer Motion
- **State Management**: React Query (TanStack Query)
- **Icons**: Lucide React
- **Styling**: Tailwind CSS v4

## Getting Started

### Prerequisites

- Node.js 18+ 
- MaiBroker Backend running on port 3001

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   # Create .env.local
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   ```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Backend Integration

This frontend is designed to work with the MaiBroker backend that uses:

- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **API**: RESTful endpoints
- **WhatsApp**: Twilio integration

### API Endpoints

The frontend communicates with these backend endpoints:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/profile` - User profile
- `GET /api/orders` - User orders
- `POST /api/orders` - Create order
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/market` - Market data
- `GET /api/trades` - Recent trades
- `GET /api/account` - Account summary
- `GET /api/stats` - System statistics

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (login/register)
│   └── query-provider.tsx # React Query provider
├── components/            # Reusable components
│   ├── LoginForm.tsx      # Login form
│   └── RegisterForm.tsx   # Registration form
└── lib/                   # Utilities
    └── api.ts            # API client
```

## Features

### Authentication
- Secure login and registration
- JWT token management
- Automatic token refresh
- Protected routes

### Dashboard
- Real-time market data display
- Order placement and management
- Trade history
- Account summary
- Order cancellation

### Order Management
- Place buy/sell orders
- View active orders
- Cancel orders
- Order status tracking

### Market Data
- Live bid/ask prices
- Market depth information
- Asset-specific data
- Real-time updates

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Backend Setup

Make sure the MaiBroker backend is running:

1. Follow the backend setup guide
2. Ensure Supabase is configured
3. Start the backend server on port 3001

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:

- Check the backend documentation
- Review the API endpoints
- Check the browser console for errors
- Ensure the backend is running and accessible
