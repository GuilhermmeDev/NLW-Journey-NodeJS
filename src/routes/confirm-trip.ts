import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod"
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import { dayjs } from "../lib/dayjs";
import nodemailer from "nodemailer"
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function confirmTrip(app: FastifyInstance) {
    await app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
        schema: {
            params: z.object({
                tripId: z.string().uuid(),
            })
        }
    } ,async (request, reply) => {
        const {tripId} = request.params

        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId,
            },
            include: {
                participants: {
                    where: {
                        is_owner: false,
                    }
                }
            }
        })

        if (!trip) {
            throw new ClientError("Trip not found")
        }

        await prisma.trip.update({
            where: {
                id: tripId,
            },
            data: {
                is_confirmed: true,
            }
        })

        const mail = await getMailClient()


        const formattedStartDate = dayjs(trip.start_at).format("LL")
        const formattedEndDate = dayjs(trip.ends_at).format("LL")
        
        

        await Promise.all([
            trip.participants.map(async (participant) => {
            const confirmationLink = `${env.API_BASE_URL}/participant/${participant.id}/confirm`

                const message = await mail.sendMail({
                    from: {
                        name: "equipe plann.er",
                        address: "plann@er.com",
                    },
                    to: participant.email,
                    subject: `Confirme sua viagem para ${trip.destination}`,
                    html: `
                    <div style="font-family: sans-serif; line-height: 1.6; font-size: 16px;">
                        <p>Plann.er</p>
                        <br>
                        <p>Você foi convidado(a) para uma viagem rumo à <strong>${trip.destination}</strong> marcado para os dias <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong></p>
                        <br>
                        <p>Para confirmar sua presença na viagem. clique no botão abaixo:</p>
                        <br>
                        <a href="${confirmationLink}">Confirmar Viagem</a>
                    </div>
                    `.trim()
                })
                console.log(nodemailer.getTestMessageUrl(message))
            })
        ])

        return "Sending Email"
    })
}