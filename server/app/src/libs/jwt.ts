import * as jwt from 'jsonwebtoken';

export class JwtService {
    private secretKey : string;
    private options : jwt.SignOptions;
    constructor(){
        this.secretKey = process.env.JWT_SECRET!;
        this.options = {
            expiresIn : '1d'
        };
    }

    generateToken(payload : any) : string {
        return jwt.sign(payload, this.secretKey, this.options);
    }

    verifyToken(token : string) : any {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            return null;
        }
    }
}